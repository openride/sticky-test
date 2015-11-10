'use strict';
/* eslint-disable require-jsdoc */
/**
 * An attempt to create pluggable "test enhancers", inspired by
 * http://www.haskellforall.com/2012/08/the-category-design-pattern.html
 *
 * Assert (and plan) will become test enhancers, and there will hopefully be a
 * nice pattern for injecting composeable setup/teardown tasks around tests.
 */

const sticky = require('./src/index');
const test = sticky({
  failIfNoTests: true,
  timeout: 1000
});

const waitFor = (p, thenDo) => ((f => p.then(f, f))(() => thenDo(p)));


const use = enhancer => testFn =>
  enhancer(arrOfP =>
    Promise.all(arrOfP)
      .then(rs => testFn.apply(null, rs)));


const compose = (a, b) => lendTask =>
  a(aArrOfP =>
    b(bArrOfP =>
      lendTask(bArrOfP.concat(aArrOfP))));


const id = lendTask =>
  lendTask([]);


const inject = what => lendTask =>
  lendTask([what]);


const timeout = t => lendTask =>
  new Promise((resolve, reject) => {
    let timedOut = false;

    const rejectTimer = setTimeout(() => {
      timedOut = true;
      reject(new Error('test timed out'));
    }, t);

    return waitFor(
      lendTask([]),
      taskResult => {
        if (!timedOut) {
          clearTimeout(rejectTimer);
          taskResult.then(resolve, reject);
        }
      });
  });


const withResource = (setup, teardown) => lendTask => {
  const arrOfP = setup();
  return waitFor(
    lendTask(arrOfP),
    taskResult =>
      waitFor(
        teardown.apply(null, arrOfP),
        cleanupResult => taskResult.then(() => cleanupResult)
      )
  );
};


const nodeCB = lendTask =>
  new Promise((resolve, reject) =>
    lendTask([
      err => err ? reject(err) : resolve()
    ]));


test(1, 'Use works with id', assert => use(id)(() => assert.ok('ran a test')));

test(1, 'Throwing test rejects', assert => {
  const theError = new Error('thrown from test');
  return use(id)(() => {
    throw theError;
  }).catch(err => assert.strictEqual(err, theError, 'Test rejected with the error thrown'));
});

test(1, 'Rejecting test rejects', assert => {
  const theError = new Error('thrown from test');
  return use(id)(() => Promise.reject(theError))
    .catch(err => assert.strictEqual(err, theError, 'Test rejected with the rejected test'));
});

test(1, 'Compose composes IDs', assert => use(compose(id, id))(() => assert.ok('test still runs')));

test(2, 'timeout passes synchronous test', assert => use(timeout(1))(() =>
  assert.ok('test ran')).then(() => assert.ok('test passed')));

test(2, 'timeout passes a fast test', assert => use(timeout(20))(() => new Promise(res =>
  setTimeout(() => res(assert.ok('test ran')), 10)).then(() => assert.ok('test passed'))));

test(1, 'timeout fails a slow test', assert => use(timeout(1))(() =>
  new Promise(res => setTimeout(res, 20)))
    .catch(() => assert.ok('timeout rejected the test')));

test(1, 'timeout fails a failing test', assert => {
  const theError = new Error('thrown from test');
  return use(timeout(1))(() => Promise.reject(theError))
    .catch(err => assert.strictEqual(err, theError, 'Test rejected with the error thrown'));
});

test(1, 'inject injects stuff', assert => use(inject(1))(i =>
  assert.equal(i, 1, 'injected param')));

test(2, 'compose orders params', assert => use(compose(inject(1), inject(2)))((a, b) => {
  assert.equal(a, 2, 'first injection is the last composed');
  assert.equal(b, 1, 'last injection is the first composed');
}));

test(1, 'left identity law holds', assert => use(compose(id, inject(1)))(n =>
  assert.equal(n, 1, 'injected 1')));

test(1, 'right identity law holds', assert => use(compose(inject(1), id))(n =>
  assert.equal(n, 1, 'injected 1')));

test(4, 'composition is associative', assert =>
  use(compose(inject(4), compose(compose(inject(3), inject(2)), inject(1))))(
    (a, b, c, d) => {
      assert.equal(a, 1);
      assert.equal(b, 2);
      assert.equal(c, 3);
      assert.equal(d, 4);
    }
  ));

test(6, 'setup, test, teardown operation and ordering', assert => {
  let didSetUp = false;
  let didTearDown = false;
  return use(withResource(
    () => [new Promise(resolve => setTimeout(() => {
      didSetUp = true;
      assert.ok('setup ran');
      resolve(1);
    }, 20))],
    setupPromise => {
      didTearDown = true;
      assert.ok('teardown ran');
      return setupPromise
        .then(n => assert.equal(n, 1, 'teardown got the setup promise'));
    }
  ))(n => new Promise(resolve => setTimeout(() => {
    assert.ok(didSetUp, 'test ran before setup');
    assert.ifError(didTearDown, 'teardown ran before test');
    assert.equal(n, 1, 'setup injected a resource');
    resolve();
  }, 20)));
});

test(1, 'rejecting setup prevents test from running', assert => {
  const theError = new Error('thrown from setup');
  return use(withResource(
    () => [Promise.reject(theError)],
    () => Promise.resolve()
  ))(() => assert.fail('test should not run'))
    .catch(err => assert.strictEqual(err, theError, 'should reject with the setup error'));
});

test(2, 'teardown runs when test fails', assert => {
  const theError = new Error('thrown from test');
  return use(withResource(
    () => [],
    () => {
      assert.ok('teardown ran');
      return Promise.resolve();
    }
  ))(() => {
    throw theError;
  }).catch(err => assert.strictEqual(err, theError, 'should reject with the test error'));
});

test(2, 'teardown runs if timeout rejects the tests', assert => use(compose(
  withResource(
    () => [],
    () => {
      assert.ok('teardown ran');
      return Promise.resolve();
    }
  ),
  timeout(1)
))(() => new Promise(resolve => setTimeout(resolve, 20)))
  .catch(() => assert.ok('test timed out')));

test(1, 'node callback test style works', assert => use(nodeCB)(cb => setTimeout(() => {
  assert.ok(true, 'ran test');
  cb();
}, 1)));

test(1, 'node callback style can error', assert => {
  const theError = new Error('test error');
  return use(nodeCB)(cb => setTimeout(() => cb(theError), 1))
    .catch(err => assert.strictEqual(err, theError, 'should reject with the test error'));
});

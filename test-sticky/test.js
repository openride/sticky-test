/*eslint-disable no-console*/
'use strict';

const assert = require('assert');
const errors = require('../src/errors.js');
const stickyAssert = require('../src/sticky-assert.js');
const runOne = require('../src/run-one.js');
const runTests = require('../src/run-tests.js');
const poll = require('../src/poll.js');


const logErr = hint => err => {
  console.error(hint, err);
  console.error(err.stack);
};

(() => {
  console.log('Custom errors');
  assert(new errors.PollTimeout() instanceof errors.PollTimeout,
    'Custom error should be an instance of itself');
  assert(new errors.PollTimeout() instanceof Error,
    'Custom error should be an instance of Error');
})();


(() => {
  console.log('sticky assert');

  let didNotify;
  let didFail;
  const onNotify = () => didNotify = true;
  const onFail = () => didFail = true;
  const testAssert = stickyAssert(onNotify, onFail);

  didNotify = didFail = false;
  testAssert(true, 'Should have passed for assert(true)');
  assert(didNotify, 'Should have notified that assert was called');

  didNotify = didFail = false;
  testAssert.ok(true, 'Should have passed for assert.ok(true)');
  assert(didNotify, 'Should have notified that assert.ok was called');

  didNotify = didFail = false;
  testAssert.throws(() => {
    throw new Error('err');
  }, Error, 'Should have thrown');
  assert(didNotify, 'Should have notified that assert.throws was called');

  didNotify = didFail = false;
  try {
    testAssert(false, 'this should make an AssertionError');
  } catch (err) {
    assert(err instanceof assert.AssertionError, 'Assertion should have failed');
  } finally {
    assert(didNotify, 'Should have notified even though the function errored');
    assert(didFail, 'Should have reported the failure through its callback');
  }

  assert.deepEqual(Object.keys(testAssert).sort(), Object.keys(assert).sort(),
    'Wrapped assert should have all the keys of normal assert.');

})();


(() => {
  console.log('Run one');

  runOne(-1)({
    plan: 0,
    name: 'test empty',
    testFn: () => null
  }).catch(() => assert.fail(null, null, 'Should have passed an empty test'))
    .catch(logErr('test empty'));

  runOne(-1)({
    plan: 2,
    name: 'test 2 asserts',
    testFn: a => {
      a(true);
      a.ok(true);
    }
  }).catch(() => assert.fail(null, null, 'Should have passed with two asserts'))
    .catch(logErr('test 2 asserts'));

  runOne(-1)({
    plan: 1,
    name: 'zero asserts with 1 planned',
    testFn: () => null
  }).then(() => assert.fail(null, null, 'Should have rejected with bad plan'))
    .catch(err => assert(err[1] instanceof errors.TestPlanError,
      'Should have rejected with a [label, TestPlanError] for bad plan'))
    .catch(logErr('zero asserts with 1 planned'));

  runOne(-1)({
    plan: 1,
    name: '2 asserts with 1 planned',
    testFn: a => {
      a(true);
      a(true);
    }
  }).then(() => assert.fail(null, null, 'Should have rejected for wrong plan'))
    .catch(err => assert(err[1] instanceof errors.TestPlanError,
      'Should have rejected with a [label, TestPlanError]'))
    .catch(logErr('2 asserts with 1 planned'));

  runOne(-1)({
    plan: 0,
    name: 'test throws',
    testFn: () => {
      throw new Error('throw');
    }
  }).then(() => assert.fail(null, null, 'Should have rejected a throwing test'))
    .catch(err => assert.equal(err[0], 'test throws',
      'Should have rejected with the test label in the payload'))
    .catch(logErr('test throws'));

  runOne(-1)({
    plan: 0,
    name: 'test rejects',
    testFn: () => Promise.reject(new Error('reject'))
  }).then(() => assert.fail(null, null, 'Should have rejected a rejecting test'))
    .catch(() => null);  // a-ok

  runOne(-1)({
    plan: 1,
    name: 'waits for promise',
    testFn: a => new Promise(resolve =>
      setTimeout(() => resolve(a(true)), 5))
  }).catch(() => assert.fail(null, null, 'Should have passed a delayed test'))
    .catch(logErr('waits for promise'));

  runOne(30)({
    plan: 1,
    name: 'timeout too-long test',
    testFn: a => new Promise(resolve =>
      setTimeout(() => resolve(a(true)), 60))
  }).then(() => assert.fail(null, null, 'Should have rejected a timed-out test'))
    .catch(err => assert(err[1] instanceof errors.TestTimeout,
      'Timed-out test should reject with [label, TestTimeout]'))
    .catch(logErr('timeout too-long test'));

})();


(() => {
  console.log('Run tests');

  const getter = a => () => a.shift();
  const fner = a => (fns => () => fns()())(getter(a));

  runTests(getter([]), 0, null)
    .catch(logErr('no tests'))
    .then(details => assert.equal(details.testCount, 0),
      'Should report zero tests run')
    .catch(logErr('no tests'));

  runTests(getter([1]), 0, () => Promise.resolve())
    .catch(logErr('1 test'))
    .then(details => assert.equal(details.testCount, 1),
      'Should report 1 test run')
    .catch(logErr('1 test'));

  runTests(getter([1]), 0, () => Promise.reject())
    .then(() => assert.fail(null, null, 'Should have failed for the rejected test'))
    .catch(details => {
      assert(details.normal, 'Should be a normal failure');
      assert.equal(details.testCount, 1, 'Should report one test was run');
      assert.equal(details.failures.length, 1, 'Should report one test failed');
    })
    .catch(logErr('1 fail'));

  runTests(getter([1, 2]), 0, fner([
    () => Promise.reject(),
    () => Promise.resolve()
  ]))
    .then(() => assert.fail(null, null, 'Should have failed for a rejecting test'))
    .catch(details => {
      assert.equal(details.testCount, 2, 'Should report that both tests were run');
      assert.equal(details.failures.length, 1, 'Should report that one test failed');
    })
    .catch(logErr('1 fail 2 tests'));

  runTests(getter([]), 0, null, true)
    .then(() => assert.fail(null, null, 'Should have failed with no tests when failIfNoTests'))
    .catch(details => assert.ok(details.err instanceof errors.NoTests, `Should have thrown a NoTests()`))
    .catch(logErr('fail no tests'));

})();


(() => {
  console.log('Poll');

  const ret1After = ms => {
    let okNow = false;
    setTimeout(() => okNow = true, ms);
    return () => okNow ? 1 : null;
  };

  const pollErrThen = fn => err => {
    if (err instanceof errors.PollTimeout) {
      return fn(err);
    } else {
      return Promise.reject(err);
    }
  };

  poll(() => 1, 1)
    .then(v => assert.equal(v, 1, 'Should resolve to the callback value'))
    .catch(logErr('poll should resolve cb value'));

  poll(ret1After(30), 60)
    .then(v => assert.equal(v, 1, 'Should resolve before being killed by the timeout'))
    .catch(pollErrThen(() => assert.fail(null, null, 'Should have resolved before the timeout')))
    .catch(logErr('poll should resolve within timeout'));

  poll(ret1After(60), 1)
    .then(() => assert.fail(null, null, 'Should be rejected if the timeout expires'))
    .catch(pollErrThen(err => assert(err instanceof errors.PollTimeout)),
      'Should reject with a PollTimeout error')
    .catch(err => assert.fail(null, null, `Unexpected other error: ${err}`))
    .catch(logErr('poll should be killed by timeout'));

  poll(() => null, 30)
    .then(() => assert.fail(null, null, 'Should have rejected after 1ms'))
    .catch(() => true);  // pass

})();

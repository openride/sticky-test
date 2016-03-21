/* eslint-disable no-console */
'use strict';

const through2 = require('through2');
const sticky = require('..');
const use = require('../compose').use;
const compose = require('../compose').compose;
const inject = require('../helpers').inject;
const injectFactory = require('../helpers').injectFactory;
const withResource = require('../helpers').withResource;
const mkErr = require('../stream-obj').mkErr;


const test = sticky()((plan, name) => sticky.compose(
  sticky.declare(name),
  sticky.countAsserts(plan),
  sticky.timeout(200)
));


test(2, 'inject', assert => new Promise(end =>
  use(inject(1))(one => {
    assert.equal(one, 1, 'inject 1');
    use(inject(2))(two => {
      assert.equal(two, 2, 'inject 2');
      end();
    });
  })));


test(2, 'injectFactory', assert => new Promise(end => {
  let n = 3;
  const testF = use(injectFactory(() => {
    n += 1;
    return inject(n);
  }));
  testF(injectedN => {
    assert.equal(injectedN, 4);
    testF(injectedNAgain => {
      assert.equal(injectedNAgain, 5);
      end();
    });
  });
}));


test(6, 'withResource', assert => {
  const setupErr = new Error('Resource setup error: kaboom');
  const testErr = { name: 'test err' };
  const teardownErr = new Error('Resource teardown error: boomka');

  const okSetup = () =>
    Promise.resolve([42]);

  const failSetup = () =>
    Promise.reject('kaboom');

  const okTeardown = () =>
    null;

  const failTeardown = () =>
    Promise.reject('boomka');

  const done = () => {
    const stream = through2.obj();
    stream.end();
    return stream;
  };

  const expectsNothing = a => {
    a.pass('woo');
    return done();
  };

  const expects42 = (a, n) => {
    a.equal(n, 42);
    return done();
  };

  const fails = () => {
    const stream = through2.obj();
    stream.push(mkErr(testErr));
    stream.end();
    return stream;
  };

  // crappy cop-out for now because wtf assert.deepStrictEqual(Errors)
  const easyErrs = chunks => chunks
    .map(chunk => chunk.type === 'error' ?
      Object.assign({}, chunk, { err: String(chunk.err) }) :
      chunk);

  const expectStream = (description, setup, teardown, testFn, expected) => new Promise(end => {
    const chunks = [];
    const enhancer = compose(sticky.assert, withResource(setup, teardown));
    use(enhancer)(testFn)
      .on('data', chunk => chunks.push(chunk))
      .on('error', err => console.error('\nerr', err))
      .on('end', () => {
        assert.deepStrictEqual(easyErrs(chunks), easyErrs(expected), description);
        end();
      });
  });

  return Promise.all([
    expectStream('Base case: asserts ok',
      okSetup,
      okTeardown,
      expectsNothing,
      [{ type: 'pass', msg: 'woo' }]),
    expectStream('Check injected resource',
      okSetup,
      okTeardown,
      expects42,
      [{ type: 'pass', msg: 42 }]),
    expectStream('failing testFn streams a failure',
      okSetup,
      okTeardown,
      fails,
      [mkErr(testErr)]),
    expectStream('failing setup',
      failSetup,
      okTeardown,
      expects42,
      [mkErr(setupErr)]),
    expectStream('failing teardown',
      okSetup,
      failTeardown,
      expects42,
      [ { type: 'pass', msg: 42 },
        mkErr(teardownErr) ]),
    expectStream('failing test: teardown still runs',
      okSetup,
      failTeardown,
      fails,
      [ mkErr(testErr),
        mkErr(teardownErr) ]),
  ]);
});


test(2, 'setup/teardown has sane timing', assert => new Promise(end => {
  const _order = [];
  use(withResource(
    () => new Promise(endSetup => setTimeout(() => {
      _order.push('setup');
      endSetup([42]);
    }, 20)),
    () => new Promise(endTeardown => setTimeout(() => {
      _order.push('teardown');
      assert.deepStrictEqual(_order, ['setup', 'test', 'teardown']);
      endTeardown(end());
    }, 20))
  ))(fortytwo => {
    assert.equal(fortytwo, 42);
    const stream = through2.obj();
    setTimeout(() => {
      _order.push('test');
      stream.end();
    }, 20);
    return stream;
  });
}));

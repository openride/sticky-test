/* eslint-disable no-console */
'use strict';

// const assert = require('assert');
const through2 = require('through2');
const stickyAssert = require('./sticky-assert.js');


const mkDiag = msg => ({
  type: 'diagnostic',
  msg
});


const mkErr = err => ({
  type: 'error',
  err
});


const mkPass = msg => ({
  type: 'pass',
  msg
});


const id = next =>
  next([]).pipe(through2());


// general generalized compose
const composeN = (_id, compose2) => function _compose(/*arguments*/) {
  if (arguments.length === 0) {
    return _id;
  } else if (arguments.length === 1) {
    return arguments[0];
  } else {
    return compose2(arguments[0], _compose.apply(null, Array.prototype.slice.call(arguments, 1)));
  }
};


// test-enhancer-specific compose2
const compose2 = (a, b) => testFn =>
  a(aPromises =>
    b(bPromises =>
      testFn(aPromises.concat(bPromises))));


// compose any number of enhancers as arguments
const compose = composeN(id, compose2);


const inject = what => next =>
  next([ what ]);


const injectFactory = whatFactory => testFn =>
  whatFactory()(testFn);


const countAsserts = expectedCount => next => {
  let assertCount = 0;
  const assertStream = through2.obj(null, null, cb => {
    if (assertCount !== expectedCount) {
      assertStream.push(mkErr(new Error(`Wrong number of assertions. Expected ${expectedCount}, but counted ${assertCount}`)));
    }
    cb();
  });
  const assert = stickyAssert(
    args => {
      assertStream.push(mkPass(args.join(', ')));
      assertCount += 1;
    },
    err => assertStream.push(mkErr(err))
  );
  return next([ assert ]).pipe(assertStream);
};


const timeout = t => next => {
  const outStream = through2.obj();
  const timer = setTimeout(() => {
    outStream.push(mkErr(new Error(`Test timed out after ${t}ms`)));
    outStream.end();
  }, t);
  return next([])
    .on('end', () => clearTimeout(timer))  // not sure if this is ok
    .pipe(outStream);
};


// enhancer factory that guarantees running setup/teardown
// teardown gets the promisified return of setup as its arg
// testFn is skipped if setup returns a rejected promise
const withResource = (setup, teardown) => next => {
  const outStream = through2.obj();

  const setupPromise = new Promise(resolve => resolve(setup()));

  setupPromise
    .then(
      resources =>
        new Promise(resolve =>
          next(resources)
            .on('data', data => outStream.push(data))
            .on('error', err => outStream.push(mkErr(err)))
            .on('end', resolve))
        .then(() =>
          new Promise(resolve => resolve(teardown(resources)))
            .catch(err => outStream.push(mkErr(
              new Error(`Resource teardown error: ${err.toString()}`))))),
      err =>
        outStream.push(mkErr(
          new Error(`Resource setup error: ${err.toString()}`))))
    .then(() => outStream.end());

  return outStream;
};


const use = enhancer =>
  testFn =>
    enhancer(resourcePromises => {
      const result = through2.obj();
      Promise
        .all(resourcePromises)
        .then(resources =>
          testFn.apply(null, resources))
        .then(
          testStream => testStream.pipe(result),
          err => {
            result.push(mkErr(err));
            result.end();
          }
        );
      return result;
    });


const mkTest = testFn => function(/*arguments*/) {
  const result = through2.obj();
  Promise.resolve()
    .then(() => testFn.apply(null, arguments))
    .catch(err => result.push(mkErr(err)))
    .then(() => result.end());
  return result;
};


// use(compose(
//   countAsserts(4),
//   inject(1),
//   inject(2),
//   inject(3),
//   withResource(
//     () => new Promise(r => setTimeout(() => r(['hi']), 200)),
//     () => null
//   ),
//   timeout(100)
// ))(mkTest((assert, one, two, three, hi) => {
//   assert.equal(one, 1);
//   assert.equal(two, 2);
//   assert.equal(three, 3);
//   assert.equal(hi, 'hi');
//   return new Promise(r => setTimeout(r, 50));
// }))
//   .on('data', d => console.log(d))
//   .on('error', err => console.error('whoops', err))
//   .on('end', () => console.log('done'));


const tests = [];


const test = (count, description, testFn) =>
  tests.push(() => {
    const outStream = through2.obj();
    outStream.push(mkDiag(description));
    return use(compose(
      countAsserts(count)
    ))(mkTest(testFn)).pipe(outStream);
  });


test(2, 'hello world', assert => {
  assert.equal(1, 1, 'one is one as one is');
  assert.ok(true, 'yea we got this');
});

test(1, 'async go!', assert => new Promise(r => setTimeout(() => {
  assert.deepEqual({a: 1}, {a: 1}, 'deep equals are deep');
  r();
}, 400)));


test(2, 'land ho!', assert => new Promise(r => setTimeout(() => {
  assert.pass('yea you did');
  assert.ifError(false, 'na ah');
  r();
}, 400)));


(() => {
  console.log('TAP version 13');
  let testCount = 0;
  const testStream = through2.obj();
  testStream
    .on('data', d => {
      if (d.type === 'diagnostic') {
        d.msg
          .split('\n')
          .forEach(l => console.log(`\n# ${l}`));
      } if (d.type === 'pass') {
        testCount += 1;
        console.log(`ok ${testCount} ${d.msg.replace('\n', '\\n')}`);
      } else if (d.type === 'error') {
        testCount += 1;
        console.log(`not ok ${testCount} ${d.err.toString()}`);
        if (typeof d.err.actual !== 'undefined' &&
            typeof d.err.expected !== 'undefined' &&
            typeof d.err.operator !== 'undefined') {
          console.log('  ---');
          Object.keys(d.err).forEach(k =>
            console.log(`    ${k}: ${d.err[k].toString().replace('\n', '\\n')}`));
          console.log('  ...');
        }
      }
    })
    .on('error', err =>
      console.log(`Bail out! Test stream errored: ${err.toString()}`))
    .on('end', () => {
      console.log(`\n1..${testCount}`);
    });

  (function runNext() {
    const currentTest = tests.shift();
    if (typeof currentTest === 'undefined') {
      return testStream.end();
    }
    currentTest()
      .on('data', d => testStream.push(d))
      .on('end', runNext);
  })();

})();

'use strict';

const through2 = require('through2');
const stickyAssert = require('./sticky-assert.js');
const mkDiag = require('./stream-obj.js').mkDiag;
const mkErr = require('./stream-obj.js').mkErr;
const mkPass = require('./stream-obj.js').mkPass;


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


const declare = message => next => {
  const outStream = through2.obj();
  outStream.push(mkDiag(message));
  return next([]).pipe(outStream);
};


const inject = what => next =>
  next([ what ]);


const injectFactory = whatFactory => testFn =>
  whatFactory()(testFn);

const peek = pre => through2.obj((chunk, enc, cb) => {
  console.log(pre || 'peek', chunk);  // eslint-disable-line no-console
  cb(null, chunk);
});


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


module.exports = {
  countAsserts,
  declare,
  inject,
  injectFactory,
  peek,
  timeout,
  withResource,
};

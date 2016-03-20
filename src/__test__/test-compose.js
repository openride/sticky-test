/* eslint-disable no-console, no-invalid-this */
'use strict';

const assert = require('assert');
const through2 = require('through2');
const compose = require('../compose').compose;
const id = require('../compose').id;
const use = require('../compose').use;


const streams = [
  [],
  [2],
  [3, 4],
];


const streamout = (args, stuff) => {
  const stream = through2.obj();
  args.forEach(arg => stream.push(arg));
  stuff.forEach(thing => stream.push(thing));
  stream.end();
  return stream;
};


const collect = stream => new Promise(resolve => {
  const output = [];
  stream
    .on('data', chunk => output.push(chunk))
    .on('end', () => resolve(output));
});


const attempt = (description, fn) => {
  try {
    fn();
    console.log(`✔ ${description}`);
  } catch (err) {
    console.error(`Failed: ${description}`);
    console.error(err);
    console.error(JSON.stringify(err));
    setTimeout(() => {
      throw err;
    });
    throw err;
  }
};


const enhancerEq = (description, a, b) =>
  streams.forEach((stream, i) =>
    Promise.all([
      collect(a(resources => streamout(resources, stream))),
      collect(b(resources => streamout(resources, stream))),
    ])
      .then(out =>
        attempt(`${description} (${i})`, () =>
          assert.deepEqual(out[0], out[1]))));


// not proofs, just examples showing that it works at least sometimes...


enhancerEq('id === compose(id)', id, compose(id));
enhancerEq('id === compose(compose(id))', id, compose(compose(id)));

const timesTwo = next =>
  next([]).pipe(through2.obj((n, _, cb) => cb(null, n * 2)));

enhancerEq('x === compose(id, x)', timesTwo, compose(id, timesTwo));
enhancerEq('x === compose(x, id)', timesTwo, compose(timesTwo, id));

const injects = next =>
  next([-1]).pipe(through2.obj((n, _, cb) => cb(null, n - 1)));

const repeats = next =>
  next([-2, -3]).pipe(through2.obj(function(n, _, cb) {
    this.push(n);
    this.push(n);
    cb();
  }));

enhancerEq('compose(compose(x, y), z) === compose(x, compose(y, z))',
  compose(compose(timesTwo, repeats), injects),
  compose(timesTwo, compose(repeats, injects)));

enhancerEq('compose(compose(x, y), z) === compose(x, y, z)',
  compose(compose(timesTwo, repeats), injects),
  compose(timesTwo, repeats, injects));


collect(use(id)(function(/*arguments*/) {
  attempt('use(id) provides no resources', () =>
    assert.equal(arguments.length, 0));
  return streamout([42], [24]);
}))
  .then(
    stuff => attempt('use(id) passes through the stream', () =>
      assert.deepEqual(stuff, [42, 24])),
    err => setTimeout(() => {
      throw err;
    })
  );

collect(use(injects)(minusOne => {
  attempt('use(injects) provides a resource', () =>
    assert.equal(minusOne, -1));
  return streamout([3], [5]);
}))
  .then(
    stuff => attempt('use(injects) processes the stream', () =>
      assert.deepEqual(stuff, [2, 4])),
    err => setTimeout(() => {
      throw err;
    })
  );

use(compose(injects, injects))((minusOne, minusOneAgain) => {
  attempt('multiple resources (first)', () =>
    assert.equal(minusOne, -1));
  attempt('multiple resources (second)', () =>
    assert.equal(minusOneAgain, -1));
  return streamout([], []);
});

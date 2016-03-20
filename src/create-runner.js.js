'use strict';

const assert = require('assert');
const runTests = require('./run-tests.js');
const use = require('./compose.js').use;
const mkTest = require('./mk-test.js');
const toTAP = require('./to-tap.js');


/**
 * Get an object't own property by key or a default
 * @param {object} obj The object
 * @param {string} k The key for the prop to check for on obj
 * @param {any} def A default to use if the key is not present on obj
 * @param {func} validate A function to validate the value
 * @returns {any} Whatever was at that key on obj, or def.
 */
const getOpt = (obj, k, def, validate) => {
  if (obj === null || typeof obj === 'undefined' || !obj.hasOwnProperty(k)) {
    return def;
  } else {
    const value = obj[k];
    assert(validate(value),
      `harness option '${k}' is an invalid value: '${value}'`);
    return value;
  }
};


/**
 * Entry to the core sticky APIs
 * @throws {AssertionError} if any options fail validation
 * @param {object?} options Harness configuration
 * @param {number?} options.timeout How long (in ms) to let a test run before
 * failing the test. Default to 100. -1 will wait forever.
 * @param {number?} options.registerTimeout How long (in ms) to wait to see if
 * register? Default: false.
 * more tests will be registered before ending. Default: 5.
 * @returns {func} A function for registering new tests
 */
const createRunner = (options) => {
  const registerTimeout = getOpt(options, 'registerTimeout', 5, t => t >= 0);

  const testQueue = [];
  const getNext = () => testQueue.shift();

  const createTest = getEnhancer => function test(/*arguments*/) {
    const args = Array.prototype.slice.apply(arguments);
    const useArgs = args.slice(0, args.length - 1);
    const testFn = args[args.length - 1];
    const testUse = use(getEnhancer.apply(null, useArgs));
    const testWrapped = mkTest(testFn);
    testQueue.push(() =>
      testUse(testWrapped));
  };

  runTests(getNext, registerTimeout)
    .pipe(toTAP())
    .pipe(process.stdout);

  return createTest;
};


module.exports = createRunner;

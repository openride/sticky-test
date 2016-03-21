'use strict';

const assert = require('assert');

const intercept = (fn, tell) => function(/*arguments*/) {
  const description = arguments[arguments.length - 1];
  try {
    fn.apply(null, arguments);
    tell(true, description);
  } catch (err) {
    tell(false, description, err);
  }
};


/**
 * Wrap the assert API and call callback whenever it's used
 * @param {func} onAssert A callback to handle assert calls
 * @returns {func} nodejs's assert API, wrapped.
 */
const stickyAssert = onAssert => {
  const wrappedAssert = intercept(assert, onAssert);
  Object.keys(assert)
    .filter(prop => typeof assert[prop] === 'function')
    .forEach(prop => {
      wrappedAssert[prop] = intercept(assert[prop], onAssert);
    });
  wrappedAssert.AssertionError = assert.AssertionError;
  wrappedAssert.pass = msg =>
    onAssert(true, msg);
  wrappedAssert.fail = msg =>
    onAssert(false, msg);
  return wrappedAssert;
};


module.exports = stickyAssert;

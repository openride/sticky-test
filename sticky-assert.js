const assert = require('assert');


/**
 * Layer an array of wrapper functions
 * @param {func[]} funcs An array of functions to layer
 * @param {func} fn The inner-most function
 * @returns {func} The wrapped-up function
 */
const wrap = funcs => fn =>
  funcs.reduceRight((inner, nextWrapper) => nextWrapper(inner), fn);


/**
 * Wrap a function, catch its AssertionErrors, sending them to a callback
 * @param {func} onFail A function to give any AssertionError we catch
 * @param {func} fn The function to wrap
 * @returns {any} The wrapped function, basically a proxy
 */
const interceptThrow = onFail => fn => function(/*arguments*/) {
  try {
    return fn.apply(null, arguments);
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      onFail(err);
    } else {
      throw err;
    }
  }
};


/**
 * Wrap a function and notify a callback whenever it is called.
 * @param {func} sideCb A callback to do some side-effect whenever the wrapped
 * function is called
 * @param {func} fn The function to wrap.
 * @returns {func} The wrapped function, basically a proxy
 */
const spyOnCalls = sideCb => fn => function(/*arguments*/) {
  sideCb();
  return fn.apply(null, arguments);
};


/**
 * Wrap the assert API and call callback whenever it's used
 * @param {func} notifyCb The notifier callback
 * @param {func} onFail A callback to handle failed assertions
 * @returns {func} nodejs's assert API, wrapped.
 */
const stickyAssert = (notifyCb, onFail) => {
  const wrapper = wrap([
    interceptThrow(onFail),
    spyOnCalls(notifyCb)
  ]);
  const wrappedAssert = wrapper(assert);
  Object.keys(assert)
    .filter(prop => typeof assert[prop] === 'function')
    .forEach(prop => {
      wrappedAssert[prop] = wrapper(assert[prop]);
    });
  wrappedAssert.AssertionError = assert.AssertionError;
  wrappedAssert.fail = msg =>
    interceptThrow(onFail)(assert.fail)(null, null, msg);
  return wrappedAssert;
};


module.exports = stickyAssert;

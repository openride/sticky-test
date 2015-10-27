// from: http://stackoverflow.com/a/17891099/1299695

/**
 * Create a custom error type that passes `instanceof Error` checks
 * @param {string} name The name for the custom error
 * @param {string} defaultMessage A default message for the error
 * @returns {Error} The new error constructor
 */
function customError(name, defaultMessage) {
  /**
   * The custom error constructor
   * @returns {CustomError} new instance
   */
  function CustomError(/*arguments*/) {
    const realErr = Error.apply(this, arguments);
    realErr.name = this.name = name;
    this.stack = realErr.stack;
    this.message = realErr.message || defaultMessage || '';
  }
  CustomError.prototype = Object.create(Error.prototype, { constructor: {
    value: CustomError,
    writeable: true,
    configurable: true
  }});
  return CustomError;
}


const PollTimeout = customError('PollTimeout', 'Polling timed out');
const TestTimeout = customError('TestTimeout', 'Test timed out');
const TestPlanError = customError('TestPlanError');

module.exports = {
  PollTimeout,
  TestTimeout,
  TestPlanError
};

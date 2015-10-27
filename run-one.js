'use strict';

const errors = require('./errors.js');
const stickyAssert = require('./sticky-assert.js');


const rejectIfBadPlan = (recorded, planned) => {
  if (recorded !== planned) {
    return Promise.reject(new errors.TestPlanError(
      `Wrong number of assertions. Planned: ${planned}, actual: ${recorded}`));
  }
};


const tryTest = fn => {
  try {
    return Promise.resolve(fn());
  } catch (err) {
    return Promise.reject(err);
  }
};


/**
 * Run an individual test
 * @param {number} timeout How long until we just kill the test?
 * @param {object} spec The test's specification
 * @param {number} spec.plan How many assertions are planned
 * @param {string} spec.name The name of this test
 * @param {func} spec.testFn A function that runs the test
 * @returns {Promise} resolving after the test has completed
 */
const runOne = timeout => spec => {
  let assertionsRecorded = 0;
  let rejectTimer;
  const incrAssertions = () => assertionsRecorded += 1;

  return new Promise((resolve, reject) => {
    console.log(`-> ${spec.name} (${spec.plan})`);
    const rejectWithLabel = err => reject([spec.name, err]);
    const testAsserter = stickyAssert(incrAssertions, rejectWithLabel);

    if (timeout !== -1) {
      rejectTimer = setTimeout(() =>
        rejectWithLabel(new errors.TestTimeout()), timeout);
    }

    tryTest(() => spec.testFn(testAsserter))
      .then(() => clearTimeout(rejectTimer))
      .then(() => rejectIfBadPlan(assertionsRecorded, spec.plan))
      .then(resolve)
      .catch(err => {
        clearTimeout(rejectTimer);
        rejectWithLabel(err);
      });
  });
};

module.exports = runOne;

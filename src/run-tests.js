'use strict';

const errors = require('./errors.js');
const poll = require('./poll.js');


/**
 * Take user-defined test specs and run them, reporting the results
 * @param {func} getNext A function to get the next test or null
 * @param {number} timeout How long to wait for new tests to show up
 * @param {func} runOne The single-test runner to use
 * @param {bool} failIfNoTests Whether to fail the suite if no tests register
 * @returns {Promise} A promise resolving when all tests have finished
 */
const runTests = (getNext, timeout, runOne, failIfNoTests) => {
  const t0 = new Date();
  const failures = [];
  let testCount = 0;

  return new Promise((resolve, reject) => {

    const finish = err => {
      const dt = new Date() - t0;
      if (!(err instanceof errors.PollTimeout)) {
        reject({ normal: false, err, testCount, failures, dt });
      } else if (failures.length > 0) {
        reject({ normal: true, err, testCount, failures, dt });
      } else if (failIfNoTests && testCount === 0) {
        reject({ normal: true, err: new errors.NoTests(), testCount, failures, dt });
      } else {
        resolve({ testCount, dt });
      }
    };

    (function runNext() {
      poll(getNext, timeout)
        .then(spec => {
          testCount += 1;
          return runOne(spec)
            .catch(err => failures.push(err))
            .then(runNext);
        })
        .catch(finish);
    })();

  });
};


module.exports = runTests;

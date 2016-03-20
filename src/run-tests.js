'use strict';

const through2 = require('through2');
const poll = require('./poll.js');
const mkErr = require('./stream-obj.js').mkErr;


/**
 * Take user-defined test specs and run them, reporting the results
 * @param {func} getNext A function to get the next test or null
 * @param {number} registerTimeout How long to wait for new tests to show up
 * @param {bool} failIfNoTests Whether to fail the suite if no tests register
 * @returns {Promise} A promise resolving when all tests have finished
 */
const runTests = (getNext, registerTimeout) => {
  const outStream = through2.obj();

  (function runNext() {
    poll(getNext, registerTimeout)
      .then(testFn =>
        new Promise(resolve =>
          testFn()
            .on('data', data => outStream.push(data))
            .on('end', resolve))
        .catch(err => outStream.push(mkErr(err)))
        .then(runNext))
      .catch(() => outStream.end());
  })();

  return outStream;
};


module.exports = runTests;

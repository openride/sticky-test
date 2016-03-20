'use strict';

const through2 = require('through2');
const mkErr = require('./stream-obj.js');


const mkTest = testFn => function(/*arguments*/) {
  const result = through2.obj();
  Promise.resolve()
    .then(() => testFn.apply(null, arguments))
    .catch(err => result.push(mkErr(err)))
    .then(() => result.end());
  return result;
};


module.exports = mkTest;

'use strict';


const mkDiag = msg => ({
  type: 'diagnostic',
  msg,
});


const mkErr = err => ({
  type: 'error',
  err,
});


const mkPass = msg => ({
  type: 'pass',
  msg,
});


module.exports = {
  mkDiag,
  mkErr,
  mkPass,
};

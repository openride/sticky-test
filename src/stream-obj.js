'use strict';


const mkDiag = msg => ({
  type: 'diagnostic',
  msg,
});


const mkErr = (err, msg) => ({
  type: 'error',
  err,
  msg: msg || String(err),
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

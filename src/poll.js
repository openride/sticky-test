'use strict';

const POLL_CHECK_TIMEOUT = 1;  // ms


const poll = (getNext, timeout) => new Promise((resolve, reject) => {
  let pollTimer;
  let rejectTimer;

  if (timeout !== -1) {
    rejectTimer = setTimeout(() => {
      clearTimeout(pollTimer);
      reject(new Error('Poll timed out'));
    }, timeout);
  }

  (function check() {
    const next = getNext();
    if (typeof next !== 'undefined') {
      clearTimeout(rejectTimer);
      resolve(next);
    } else {
      pollTimer = setTimeout(check, POLL_CHECK_TIMEOUT);
    }
  })();
});


module.exports = poll;

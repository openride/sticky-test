/*eslint-disable no-console*/

const exitErr = dt => {
  console.log(`FAILED in ${dt / 100}s :(`);
  process.exit(1);
};

const failOne = failure => {
  const name = failure[0];
  const err = failure[1];
  console.error(`× ${name}`);
  if (err instanceof Error) {
    console.error(`  Test rejected with ${err.name} (${err.message})`);
    console.error(`  ${err.stack}`);
  } else {
    console.error(`  Test rejected with '${err}'`);
  }
};

const fail = details => {
  if (details.normal) {
    console.error(`${details.failures.length} tests failed :(`);
    details.failures.forEach(failOne);
    exitErr(details.dt);
  } else {
    console.error('Tests crashed without finishing:', details.err);
    exitErr(details.dt);
  }
};

const ok = details =>
  console.log(`${details.testCount} tests passed in ${details.dt / 1000}s, woo!`);


module.exports = { ok, fail };

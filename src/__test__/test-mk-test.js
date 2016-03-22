'use strict';

const sticky = require('..');
const mkTest = require('../mk-test');
const mkErr = require('../stream-obj').mkErr;


const test = sticky()((plan, name) => sticky.compose(
  sticky.declare(name),
  sticky.countAsserts(plan),
  sticky.timeout(100)
));


test(2, 'Test return is promisified and then streamified', assert => new Promise(end => {
  mkTest(() => null)()
    .on('data', d => assert.fail(`noop test should not stream anything but got ${d}`))
    .on('end', () => assert.pass('mkTest ends the stream for a noop test'));

  mkTest(() => new Promise(t => setTimeout(t, 24)))()
  .on('data', d => assert.fail(`noop promise test should not stream anything but got ${d}`))
  .on('end', () => {
    assert.pass('mkTest waits for the promise to resolve, then ends the test');
    end();
  });
}));


test(2, 'Throwing test bodies should be logged not ok', assert => new Promise(end => {
  const testErr = new Error('test error');

  const errTestStream = sticky.use(sticky.id)(mkTest(() => {
    throw testErr;
  }));

  errTestStream
    .on('data', data => assert.deepEqual(data, mkErr(testErr), 'should stream back the error'))
    .on('error', err => assert.fail(`stream errored: ${err}`))
    .on('end', () => {
      assert.pass('should finish');
      end();
    });
}));

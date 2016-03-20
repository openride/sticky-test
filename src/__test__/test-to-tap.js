/* eslint-disable no-console */
'use strict';

const assert = require('assert');
const through2 = require('through2');
const toTAP = require('../to-tap');


const expect = (description, inputs, expected) => {
  let output = '';
  const source = through2.obj();
  const tap = toTAP();

  const report = () => {
    try {
      assert.equal(output, expected);
      console.log('✔', description);
    } catch (err) {
      console.error(`Failed: ${description}`);
      console.error(err.message);
      console.error(JSON.stringify(err, null, 2));
      throw err;
    }
  };

  const collect = through2.obj((line, _, cb) => {
    cb(null, output += line);
  }, cb => {
    report();
    cb();
  });

  source
    .pipe(tap)
    .pipe(collect);

  inputs.forEach(obj =>
    source.push(obj));

  source.end();

};


expect('Base case: no tests', [], `
TAP version 13

1..0
`);


expect('One diagnostic', [
  { type: 'diagnostic', msg: 'Hello' },
], `
TAP version 13

# Hello

1..0
`);


expect('One passing test', [
  { type: 'pass', msg: 'should pass' },
], `
TAP version 13
ok 1 should pass

1..1
`);


expect('One failing test', [
  { type: 'error', err: new Error('Bad times') },
], `
TAP version 13
not ok 1 Error: Bad times
  ---
  ...

1..1
`);


expect('One test with a diagnostic', [
  { type: 'diagnostic', msg: 'Hello' },
  { type: 'pass', msg: 'should pass' },
], `
TAP version 13

# Hello
ok 1 should pass

1..1
`);


expect('One failing test with a diagnostic', [
  { type: 'diagnostic', msg: 'Hello' },
  { type: 'error', err: new Error('Bad times') },
], `
TAP version 13

# Hello
not ok 1 Error: Bad times
  ---
  ...

1..1
`);


let ne12;
try {
  assert.equal(1, 2);
} catch (err) {
  ne12 = err;
}
expect('One failing test with a diagnostic', [
  { type: 'diagnostic', msg: 'Hello' },
  { type: 'error', err: ne12 },
], `
TAP version 13

# Hello
not ok 1 AssertionError: 1 == 2
  ---
    name: AssertionError
    actual: 1
    expected: 2
    operator: ==
    message: 1 == 2
    generatedMessage: true
  ...

1..1
`);


expect('All together now', [
  { type: 'diagnostic', msg: 'Hello' },
  { type: 'pass', msg: 'should pass' },
  { type: 'error', err: new Error('Bad times') },
  { type: 'diagnostic', msg: 'Goodbye' },
  { type: 'pass', msg: 'last one' },
], `
TAP version 13

# Hello
ok 1 should pass
not ok 2 Error: Bad times
  ---
  ...

# Goodbye
ok 3 last one

1..3
`);

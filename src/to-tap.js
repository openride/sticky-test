/* eslint-disable no-invalid-this */
'use strict';

const through2 = require('through2');
const pipe = require('multipipe');
const YAML = require('yamljs');


const escapeNewlines = str =>
  String(str).replace('\n', '\\n');


const toTAP = () => {
  let testCount = 0;
  let passing = 0;
  let failing = 0;

  const tapChunks = through2.obj(
    function(chunk, enc, cb) {
      if (chunk.type === 'diagnostic') {
        this.push('');
        chunk.msg
          .split(`\n`)
          .forEach(l => this.push(`# ${l}`));
      } else if (chunk.type === 'pass') {
        testCount += 1;
        passing += 1;
        this.push(`ok ${testCount} ${escapeNewlines(chunk.msg)}`);
      } else if (chunk.type === 'error') {
        testCount += 1;
        failing += 1;
        this.push(`not ok ${testCount} ${escapeNewlines(chunk.msg)}`);
        this.push('  ---');
        YAML
          .stringify(Object.assign({}, chunk.err), 4, 2)
          .split('\n')
          .filter(line => line.trim() !== '')
          .map(line => `    ${line}`)
          .forEach(indented => this.push(indented));
        if (chunk.err && chunk.err.stack) {
          String(chunk.err.stack)
            .split('\n')
            .filter(line => line.trim() !== '')
            .map(line => `    | ${line}`)
            .forEach(indented => this.push(indented));
        }
        this.push('  ...');
      } else {
        throw new Error(`Unrecognized chunk type: '${chunk.type}'`);
      }
      cb();
    },
    function(cb) {
      this.push('');
      this.push(`1..${testCount}`);
      this.push(`# tests ${testCount}`);
      if (passing > 0) {
        this.push(`# pass  ${passing}`);
      }
      if (failing > 0) {
        this.push(`# fail  ${failing}`);
      }
      cb();
    }
  );

  tapChunks.push('\nTAP version 13');

  const breakLines = through2.obj((line, enc, cb) =>
    cb(null, `${line}\n`));


  return pipe(tapChunks, breakLines);
};


module.exports = toTAP;

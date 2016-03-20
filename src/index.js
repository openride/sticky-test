'use strict';

const sticky = require('./create-runner.js');
const compose = require('./compose.js');
const helpers = require('./helpers.js');


module.exports = Object.assign(sticky, compose, helpers);

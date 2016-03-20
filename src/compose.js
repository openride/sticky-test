const through2 = require('through2');
const mkErr = require('./stream-obj.js').mkErr;


const id = next =>
  next([]).pipe(through2.obj());


// general generalized compose
const composeN = (_id, compose2) => function _compose(/*arguments*/) {
  if (arguments.length === 0) {
    return _id;
  } else if (arguments.length === 1) {
    return arguments[0];
  } else {
    return compose2(arguments[0], _compose.apply(null, Array.prototype.slice.call(arguments, 1)));
  }
};


// test-enhancer-specific compose2
const compose2 = (a, b) => testFn =>
  a(aPromises =>
    b(bPromises =>
      testFn(aPromises.concat(bPromises))));


// compose any number of enhancers as arguments
const compose = composeN(id, compose2);


const use = enhancer =>
  testFn =>
    enhancer(resourcePromises => {
      const result = through2.obj();
      Promise
        .all(resourcePromises)
        .then(resources =>
          testFn.apply(null, resources))
        .then(
          testStream =>
            testStream.pipe(result),
          err => {
            result.push(mkErr(err));
            result.end();
          }
        );
      return result;
    });


module.exports = {
  compose,
  id,
  use,
};

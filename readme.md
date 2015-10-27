# Sticky

Promise-first testing with no surprises.

#### If your test runs synchronously, just write it:

```js
const sticky = require('sticky');
const test = sticky();
test(1, 'Department of redundancies department', assert => {
  assert.equal('tautology', 'tautology', 'Pass because it passes');
});
```

#### If it's async, just return a promise:

```js
const sticky = require('sticky');
const test = sticky({timeout: 1000});

test(1, 'Off to the races', assert => new Promise(resolve =>
  setTimeout(() => {
    assert(true, 'One day sticky will output in tap format');
    resolve();
  }, 900)));

test(0, 'This test takes FOR EVVVVVVER', () => new Promise(resolve =>
  null));  // `resolve` never gets called so this test times out
```

outputs:

```
-> Off to the races (1)
-> This test takes FOR EVVVVVVER (0)
1 tests failed :(
× This test takes FOR EVVVVVVER
  Test rejected with TestTimeout (Test timed out)
  TestTimeout
    at CustomError.Error (native)
    at new CustomError (/home/phil/code/sticky/errors.js:15:27)
    at null._onTimeout (/home/phil/code/sticky/run-one.js:45:25)
    at Timer.listOnTimeout (timers.js:89:15)
FAILED in 1.919s :(
```


## API

### `sticky(options: object): func`

Returns a `test` function that you can use to register tests to run.

`options.timeout: number`: How long to wait for an async test before failing it. Defaults to 100ms.

`options.registerTimeout: number`: How long to keep polling for new tests to be registered since the last test ran. You can call `test` asynchronously with `sticky`, no need to register them all in the first tick. However, if you need to start up a slow resource, you may need to increase this timeout. Defaults to 5ms.


### `test(plan: number, message: string, testFn: func)`

Returned from `sticky()` (see above).

`plan`: The number of `assert`s your tests will call.

`msg`: A description of this test

`testFn`: a callback to run your actual tests. `testFn` is called with a single argument, `assert`. If you return a promise, `sticky` will wait for it to resolve or reject before moving on to the next test.


### `assert`

Provided as the only parameter to `testFn` callbacks (see above).

A proxied version of nodejs's [builtin `assert`](https://nodejs.org/api/all.html#all_assert). The API is the same, except for `assert.fail`, which only takes a single argument (the message to fail with).


## Dev notes

Run sticky's own unit tests with `npm test`.

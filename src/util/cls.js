'use strict';

const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

exports.middleware = function (req, res, next) {
    asyncLocalStorage.run({ req }, next);
};

exports.getReq = function () {
    const store = asyncLocalStorage.getStore();
    return store ? store.req : undefined;
};

exports.patchMiddleware = function (fn) {
    return fn;
};

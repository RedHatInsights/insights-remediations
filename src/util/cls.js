'use strict';

const httpContext = require('express-http-context');

const P = require('bluebird');
const clsBluebird = require('cls-bluebird');
clsBluebird(httpContext.ns, P);

exports.middleware = function (req, res, next) {
    httpContext.set('req', req);
    next();
};

exports.getReq = function () {
    return httpContext.get('req');
};

exports.patchMiddleware = function (fn) {
    return function (req, res, next) {
        return fn(req, res, httpContext.ns.bind(next));
    };
};

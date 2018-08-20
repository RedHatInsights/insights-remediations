'use strict';

const httpContext = require('express-http-context');

exports.middleware = function (req, res, next) {
    httpContext.set('req', req);
    next();
};

exports.getReq = function () {
    return httpContext.get('req');
};

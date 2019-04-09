'use strict';

const uuid = require('uuid');
const HEADER = 'x-rh-insights-request-id';

/* eslint-disable security/detect-object-injection */
module.exports = function (req, res, next) {
    if (typeof req.headers[HEADER] === 'undefined') {
        req.headers[HEADER] = uuid.v4();
    }

    next();
};

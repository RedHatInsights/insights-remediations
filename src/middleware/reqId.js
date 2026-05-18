'use strict';

const { randomUUID } = require('crypto');
const HEADER = 'x-rh-insights-request-id';

/* eslint-disable security/detect-object-injection */
module.exports = function (req, res, next) {
    if (typeof req.headers[HEADER] === 'undefined') {
        req.headers[HEADER] = randomUUID();
    }

    next();
};

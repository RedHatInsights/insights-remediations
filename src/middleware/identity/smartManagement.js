'use strict';

const errors = require('../../errors');

module.exports = function (req, res, next) {
    if (!req.entitlements.smart_management) {
        return next(new errors.Forbidden());
    }

    next();
};


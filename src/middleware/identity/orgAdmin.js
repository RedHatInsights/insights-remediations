'use strict';

const errors = require('../../errors');

module.exports = function (req, res, next) {
    if (req.user.is_org_admin === true) {
        return next();
    }

    return next(new errors.Forbidden('Organization admin access required'));
};

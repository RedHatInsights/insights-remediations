'use strict';

const errors = require('../../errors');

module.exports = function (req, res, next) {
    if (req.identity.type !== 'User' && req.identity.type !== 'ServiceAccount') {
        return next(new errors.Forbidden('Supplied identity not valid for requested operation'));
    }

    if (!req.identity.user.username || req.identity.user.is_internal === undefined) {
        return next(new errors.Forbidden('Supplied identity invalid'));
    }

    return next();
};

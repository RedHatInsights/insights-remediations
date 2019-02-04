'use strict';

const errors = require('../../errors');

module.exports = function (req, res, next) {
    if (req.identity.type !== 'User' || !req.identity.user.username || req.identity.user.is_internal === undefined) {
        return next(new errors.Forbidden());
    }

    next();
};

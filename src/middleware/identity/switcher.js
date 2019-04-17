'use strict';

module.exports = function (req, res, next) {
    if (!req.identity || req.identity.type !== 'User' || !req.identity.user.is_internal) {
        return next();
    }

    if (req.query.username) {
        req.user.username = req.query.username;
    }

    if (req.query.account) {
        req.user.account_number = req.query.account;
    }

    next();
};

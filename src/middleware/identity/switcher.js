'use strict';

module.exports = function (req, res, next) {
    if (!req.identity.user.is_internal) {
        return next();
    }

    if (req.query.username) {
        req.user.username = req.query.username;
    }

    if (req.query.account_number) {
        req.user.account_number = req.query.account_number;
    }

    next();
};

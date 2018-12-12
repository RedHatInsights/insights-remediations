'use strict';

module.exports = function (req, res, next) {
    if (!req.identity.is_internal) {
        return next();
    }

    if (req.query.username) {
        req.identity.username = req.query.username;
    }

    if (req.query.account_number) {
        req.identity.account_number = req.query.account_number;
    }

    next();
};

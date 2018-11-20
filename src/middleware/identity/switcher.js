'use strict';

module.exports = function (req, res, next) {
    if (!req.identity.is_internal) {
        return next();
    }

    if (req.query.user_id) {
        req.identity.id = parseInt(req.query.user_id);
    }

    if (req.query.account_number) {
        req.identity.account_number = req.query.account_number;
    }

    next();
};

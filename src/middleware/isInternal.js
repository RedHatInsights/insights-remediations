'use strict';

module.exports = function (req, res, next) {
    if (req.user && req.user.is_internal === true) {
        return next();
    }

    res.status(404).end();
};

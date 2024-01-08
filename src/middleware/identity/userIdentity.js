'use strict';

const errors = require('../../errors');

module.exports = function (req, res, next) {
    switch(req.identity.type) {
        case 'User':
            if (!req.identity?.user?.username || req.identity?.user?.is_internal === undefined) {
                return next(new errors.Forbidden('Supplied identity invalid'));
            }
            break;

        case 'ServiceAccount':
            if (!req.identity?.service_account?.username) {
                return next(new errors.Forbidden('Supplied service account identity invalid'));
            }
            break;

        default:
            return next(new errors.Forbidden('Supplied identity not valid for requested operation'));
    }

    return next();
};

'use strict';

const errors = require('../../errors');
const _ = require('lodash');

module.exports = function (req, res, next) {
    switch (req.identity.type) {
        case 'User':
            if ( !_.get(req, 'identity.user.username') || !_.get(req, 'identity.user.is_internal') ) {
                return next(new errors.Forbidden('Supplied user identity invalid'));
            }
            break;

        case 'ServiceAccount':
            if (!_.get(req, 'identity.service_account.username')) {
                return next(new errors.Forbidden('Supplied service account identity invalid'));
            }
            break;

        default:
            return next(new errors.Forbidden('Supplied identity not valid for requested operation'));
    }

    return next();
};

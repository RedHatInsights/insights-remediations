'use strict';

const _ = require('lodash');

const config = require('../config');
const errors = require('../errors');
const probes = require('../probes');
const rbacConnector = require('../connectors/rbac');

module.exports = function (permission) {
    const splitPermission = _.split(permission, ':');
    const srcPermission = {resource: splitPermission[1], resourceType: splitPermission[2]};

    return async function (req, res, next) {
        if (config.rbac.enforce) {
            const access = await rbacConnector.getRemediationsAccess();
            const accessPermissions = _.map(access.data, 'permission');

            if (_.includes(accessPermissions, `remediations:*:*`) ||
                _.includes(accessPermissions, `remediations:${srcPermission.resource}:*`) ||
                _.includes(accessPermissions, `remediations:${srcPermission.resource}:${srcPermission.resourceType}`) ||
                _.includes(accessPermissions, `remediations:*:${srcPermission.resourceType}`)) {
                return next();
            }

            probes.rbacErrorCount(permission, accessPermissions);

            return next(new errors.Forbidden(
                `Permission remediations:${srcPermission.resource}:${srcPermission.resourceType} is required for this operation`
            ));
        }

        return next();
    };
};

'use strict';

const _ = require('lodash');

const config = require('../config');
const errors = require('../errors');
const probes = require('../probes');
const rbacConnector = require('../connectors/rbac');
const kesselConnector = require('../connectors/kessel');

/* eslint-disable max-len */
module.exports = function (permission) {
    const splitPermission = _.split(permission, ':');
    const srcPermission = {resource: splitPermission[1], resourceType: splitPermission[2]};

    return async function (req, res, next) {
        // Skip RBAC checks for system-level requests (cert-auth on '/playbooks' endpoint)
        if (req.identity.type === 'System') {
            return next();
        }

        // If RBAC enforcement is disabled, allow all requests
        if (!config.rbac.enforce) {
            return next();
        }

        try {
            let hasAccess = false;

            if (config.kessel.enabled) {
                // Use Kessel for authorization
                hasAccess = await checkKesselPermission(srcPermission, req);
            } else {
                // Use traditional RBAC
                hasAccess = await checkTraditionalRbacPermission(srcPermission, permission);
            }

            if (hasAccess) {
                return next();
            }

            probes.rbacErrorCount(permission, []);

            return next(new errors.Forbidden(
                `Permission remediations:${srcPermission.resource}:${srcPermission.resourceType} is required for this operation`
            ));
        }
        catch (e) {
            return next(e);
        }
    };
};

async function checkTraditionalRbacPermission(srcPermission, permission) {
    const access = await rbacConnector.getRemediationsAccess();
    
    if (!access || !access.data) {
        return false;
    }

    const accessPermissions = _.map(access.data, 'permission');

    return _.includes(accessPermissions, `remediations:*:*`) ||
           _.includes(accessPermissions, `remediations:${srcPermission.resource}:*`) ||
           _.includes(accessPermissions, `remediations:${srcPermission.resource}:${srcPermission.resourceType}`) ||
           _.includes(accessPermissions, `remediations:*:${srcPermission.resourceType}`);
}

async function checkKesselPermission(srcPermission, req) {
    try {
        // Get user identity from request
        const identity = getIdentityFromRequest(req);
        if (!identity) {
            return false;
        }

        // Use Kessel connector to check permission
        const hasPermission = await kesselConnector.hasPermission(
            srcPermission.resource,
            srcPermission.resourceType,
            identity.org_id || identity.identity?.org_id,
            identity.identity?.service_account?.user_id || identity.user_id || identity.identity?.user?.user_id
        );

        return hasPermission;
    } catch (error) {
        // Log error but don't fail open - return false to deny access
        console.error('Error checking Kessel permission:', error);
        return false;
    }
}

function getIdentityFromRequest(req) {
    // Try to get identity from req.identity first (processed by identity middleware)
    if (req.identity && req.identity.identity) {
        return req.identity.identity;
    }

    // Fallback to parsing x-rh-identity header directly
    const identityHeader = req.headers['x-rh-identity'];
    if (identityHeader) {
        try {
            const identityString = Buffer.from(identityHeader, 'base64').toString();
            return JSON.parse(identityString);
        } catch (error) {
            console.warn('Failed to parse x-rh-identity header:', error);
        }
    }

    return null;
}

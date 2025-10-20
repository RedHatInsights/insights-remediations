'use strict';

const IDENTITY_HEADER = 'x-rh-identity';
const errors = require('../../errors');
const log = require('../../util/log');

module.exports = function (req, res, next) {
    // eslint-disable-next-line security/detect-object-injection
    const raw = req.headers[IDENTITY_HEADER];
    const reqId = req.id;

    if (raw === undefined) {
        log.info({headers: req.headers, reqId}, 'rejecting request due to missing identity header');
        return next(new errors.Unauthorized());
    }

    try {
        const value = Buffer.from(raw, 'base64').toString('utf8');
        const idHeader = JSON.parse(value);
        req.identity = idHeader.identity;
        req.entitlements = idHeader.entitlements;
        log.debug({identity: req.identity,
            entitlements: req.entitlements,
            reqId}, 'parsed identity header');

        // allow for anemic tenants (org_id present but no account_number)
        if (!(req.identity.account_number || req.identity.org_id)) {
            return next(new errors.Unauthorized());
        }

        if (req.identity.type === 'User') {
            req.user = {
                account_number: req.identity.account_number || '', // empty string for anemic tenant
                tenant_org_id: req.identity.org_id,
                username: req.identity.user.username,
                is_internal: req.identity.user.is_internal
            };
            req.type = "User"

            if (!req.identity?.user?.username || req.identity.user.username.trim() === '') {
                return next(new errors.Forbidden('Supplied identity invalid'));
            }
        }

        if (req.identity.type === 'ServiceAccount') {
            req.user = {
                account_number: '',
                tenant_org_id: req.identity.org_id,
                username: req.identity.service_account.username,
                is_internal: false
            };
            req.type = "ServiceAccount"
        }

        if (req.identity.type === 'System') {
            req.user = {
                account_number: req.identity.account_number || '',
                tenant_org_id: req.identity.org_id,
                username: null, // System type doesn't have username
                is_internal: false
            };
            req.type = "System"
        }

        next();
    } catch (e) {
        log.debug({header: raw, error: e.message, reqId}, 'Error decoding identity header');
        next(new errors.BadRequest('IDENTITY_HEADER', 'Invalid identity header'));
    }
};

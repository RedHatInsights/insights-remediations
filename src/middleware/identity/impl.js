'use strict';

const IDENTITY_HEADER = 'x-rh-identity';
const FORWARDED_IDENTITY_HEADER = 'x-forwarded-identity';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const errors = require('../../errors');
const log = require('../../util/log');

function isSatelliteCertAuth (identity) {
    if (!identity || identity.type !== 'System' || !identity.system) {
        return false;
    }

    const rawAuthType = identity.auth_type || identity.internal?.auth_type;
    const authType = typeof rawAuthType === 'string' ? rawAuthType.toLowerCase() : '';
    return authType === 'cert-auth' && identity.system.cert_type === 'satellite';
}

function canonicalUuid (value) {
    if (!UUID_PATTERN.test(value)) {
        return null;
    }

    return value.toLowerCase();
}

// Satellite cert-auth may scope a single host via X-Forwarded-Identity.
// Other identities ignore the header. A blank value is treated as absent.
function applyForwardedIdentity (req) {
    if (!isSatelliteCertAuth(req.identity)) {
        return null;
    }

    const raw = req.headers[FORWARDED_IDENTITY_HEADER];
    if (raw === undefined || raw === null) {
        return null;
    }

    const trimmed = String(raw).trim();
    if (trimmed === '') {
        return null;
    }

    const canonical = canonicalUuid(trimmed);
    if (!canonical) {
        log.info({reqId: req.id}, 'rejecting request due to malformed X-Forwarded-Identity header');
        return new errors.Forbidden('Invalid X-Forwarded-Identity header');
    }

    req.forwardedIdentity = canonical;
    return null;
}

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
                is_internal: req.identity.user.is_internal,
                is_org_admin: req.identity.user.is_org_admin === true
            };
            req.type = "User";

            if (!req.identity?.user?.username || req.identity.user.username.trim() === '') {
                return next(new errors.Forbidden('Supplied identity invalid'));
            }
        }

        if (req.identity.type === 'ServiceAccount') {
            req.user = {
                account_number: '',
                tenant_org_id: req.identity.org_id,
                username: req.identity.service_account.username,
                is_internal: false,
                is_org_admin: req.identity.service_account.is_org_admin === true
            };
            req.type = "ServiceAccount";
        }

        const forwardedError = applyForwardedIdentity(req);
        if (forwardedError) {
            return next(forwardedError);
        }

        next();
    } catch (e) {
        log.debug({header: raw, error: e.message, reqId}, 'Error decoding identity header');
        next(new errors.BadRequest('IDENTITY_HEADER', 'Invalid identity header'));
    }
};

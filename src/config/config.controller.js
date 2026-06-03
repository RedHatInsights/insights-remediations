'use strict';

const errors = require('../errors');
const db = require('../db');
const config = require('../config');
const { ValidationError } = require('sequelize');

function formatOverridesResponse(orgConfig) {
    const overrides = {};
    if (orgConfig?.plan_retention_days != null) {
        overrides.plan_retention_days = orgConfig.plan_retention_days;
    }
    if (orgConfig?.plan_warning_days != null) {
        overrides.plan_warning_days = orgConfig.plan_warning_days;
    }
    return overrides;
}

/**
 * GET /v1/config
 *
 * Returns the organization-wide configuration values in use for plan retention and warning
 * periods. Each field reflects a custom override value when set, or the system default when
 * no override exists. All configuration fields are always included in the response.
 *
 * To see only system default values, use GET /v1/config/defaults.
 * To see only custom overrides, use GET /v1/config/overrides.
 *
 * Sample response (retention uses default, warning overridden):
 * {
 *   "plan_retention_days": 120,
 *   "plan_warning_days": 14
 * }
 *
 * Sample response (no overrides):
 * {
 *   "plan_retention_days": 120,
 *   "plan_warning_days": 30
 * }
 */
exports.get = errors.async(async function (req, res) {
    const { tenant_org_id } = req.user;
    const orgConfig = await db.org_config.findByPk(tenant_org_id);

    return res.json({
        plan_retention_days: orgConfig?.plan_retention_days ?? config.plan_retention.retentionDays,
        plan_warning_days: orgConfig?.plan_warning_days ?? config.plan_retention.warningDays
    });
});

/**
 * GET /v1/config/defaults
 *
 * Returns the system default value for each organization-wide configuration field.
 * All configuration fields are always included in the response.
 *
 * Sample response:
 * {
 *   "plan_retention_days": 120,
 *   "plan_warning_days": 30
 * }
 */
exports.getDefaults = errors.async(async function (req, res) {
    return res.json({
        plan_retention_days: config.plan_retention.retentionDays,
        plan_warning_days: config.plan_retention.warningDays
    });
});

/**
 * GET /v1/config/overrides
 *
 * Returns the custom override value for each organization-wide configuration field that
 * has been overridden for the caller's organization. Only fields with a custom override
 * value are included; fields using the system default are omitted.
 *
 * Sample response (one field overridden):
 * {
 *   "plan_warning_days": 14
 * }
 *
 * Sample response (no overrides):
 * {}
 */
exports.getOverrides = errors.async(async function (req, res) {
    const { tenant_org_id } = req.user;
    const orgConfig = await db.org_config.findByPk(tenant_org_id);

    return res.json(formatOverridesResponse(orgConfig));
});

/**
 * PUT /v1/config/overrides
 *
 * Replaces organization-wide configuration override values. Only organization admins can call this endpoint.
 * Omitted fields are cleared (override set to null; system default is used). To change one override while
 * keeping another, include the current value for the field that should stay overridden.
 * Validates that plan_warning_days < plan_retention_days (using effective values).
 *
 * Sample input (override one field; other reverts to default):
 * {
 *   "plan_warning_days": 14
 * }
 *
 * Sample input (override both, or update one while preserving the other):
 * {
 *   "plan_retention_days": 90,
 *   "plan_warning_days": 14
 * }
 *
 * Sample response (single field in request):
 * {
 *   "plan_warning_days": 14
 * }
 *
 * Sample response (both fields in request, including an unchanged override):
 * {
 *   "plan_retention_days": 90,
 *   "plan_warning_days": 14
 * }
 *
 * Sample error (validation failure):
 * {
 *   "errors": [{
 *     "status": 400,
 *     "code": "INVALID_CONFIG",
 *     "title": "Data validation error",
 *     "details": {
 *       "message": "Warning period (30 days) must be less than retention period (25 days)"
 *     }
 *   }]
 * }
 */
exports.putOverrides = errors.async(async function (req, res) {
    const { tenant_org_id } = req.user;
    const { plan_retention_days, plan_warning_days } = req.body ?? {};

    const orgConfigRow = {
        org_id: tenant_org_id,
        plan_retention_days: plan_retention_days !== undefined ? plan_retention_days : null,
        plan_warning_days: plan_warning_days !== undefined ? plan_warning_days : null
    };

    let orgConfig;
    try {
        [orgConfig] = await db.org_config.upsert(orgConfigRow);
    } catch (err) {
        if (err instanceof ValidationError) {
            throw new errors.BadRequest(
                'INVALID_CONFIG',
                'Data validation error',
                { message: err.errors[0].message }
            );
        }
        throw err;
    }

    // Return the fields that have a custom override value (i.e. not null which means they use the system default)
    return res.json(formatOverridesResponse(orgConfig));
});

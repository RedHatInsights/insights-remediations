'use strict';

const errors = require('../errors');
const db = require('../db');
const config = require('../config');
const { ValidationError } = require('sequelize');

function formatConfigResponse(orgConfig) {
    const plan_retention_days = orgConfig?.plan_retention_days ?? null;
    const plan_warning_days = orgConfig?.plan_warning_days ?? null;

    return {
        plan_retention_days: {
            override: plan_retention_days,
            default: config.plan_retention.retentionDays
        },
        plan_warning_days: {
            override: plan_warning_days,
            default: config.plan_retention.warningDays
        }
    };
}

/**
 * GET /v1/config
 *
 * Retrieves the organization's configuration settings for plan retention and warning periods.
 * Returns both the custom override values (null if not set) and system defaults.
 *
 * Sample response:
 * {
 *   "plan_retention_days": {
 *     "override": null,     // null = using system default
 *     "default": 120
 *   },
 *   "plan_warning_days": {
 *     "override": 14,       // custom value set
 *     "default": 30
 *   }
 * }
 */
exports.get = errors.async(async function (req, res) {
    const { tenant_org_id } = req.user;
    const orgConfig = await db.org_config.findByPk(tenant_org_id);

    // Return null for override when no custom value is set
    return res.json(formatConfigResponse(orgConfig));
});

/**
 * PATCH /v1/config
 *
 * Updates organization configuration settings. Only organization admins can call this endpoint.
 * Omitted fields remain unchanged. Set a field to null to clear the override and use the system default.
 * Validates that plan_warning_days < plan_retention_days (using effective values).
 *
 * Sample input:
 * {
 *   "plan_retention_days": 90,
 *   "plan_warning_days": null    // Clear override, use system default (30)
 * }
 *
 * Sample response:
 * {
 *   "plan_retention_days": {
 *     "override": 90,
 *     "default": 120
 *   },
 *   "plan_warning_days": {
 *     "override": null,
 *     "default": 30
 *   }
 * }
 *
 * Sample error (validation failure):
 * {
 *   "errors": [{
 *     "status": 400,
 *     "code": "INVALID_CONFIG",
 *     "title": "Data validation error",
 *     "details": {
 *       "message": "Warning period (30 days) must be less than retention period (20 days)"
 *     }
 *   }]
 * }
 */
exports.patch = errors.async(async function (req, res) {
    const { tenant_org_id } = req.user;
    const body = req.body ?? {};
    const { plan_retention_days: bodyRetentionDays, plan_warning_days: bodyWarningDays } = body;

    const current = await db.org_config.findByPk(tenant_org_id);

    // For each field:
    // - If present in request body (including null), use that value
    // - Otherwise, keep current value (including null)
    // - If no row in table, use null (meaning use system default)
    const plan_retention_days = ('plan_retention_days' in body) ? bodyRetentionDays : (current?.plan_retention_days ?? null);
    const plan_warning_days = ('plan_warning_days' in body) ? bodyWarningDays : (current?.plan_warning_days ?? null);

    // We're creating a new object here because "current" will be null if there are no existing overrides
    const orgConfig = {
        org_id: tenant_org_id,
        plan_retention_days,
        plan_warning_days
    };

    try {
        await db.org_config.upsert(orgConfig);
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

    return res.json(formatConfigResponse(orgConfig));
});

/**
 * DELETE /v1/config/:field
 *
 * Resets a specific configuration field to null (use system default). Only organization admins can call this endpoint.
 * Validates that the reset won't violate the rule: plan_warning_days < plan_retention_days.
 *
 * Path parameter:
 *   field: "plan_retention_days" or "plan_warning_days"
 *
 * Sample request:
 *   DELETE /v1/config/plan_warning_days
 *
 * Sample response:
 * {
 *   "plan_retention_days": {
 *     "override": 90,
 *     "default": 120
 *   },
 *   "plan_warning_days": {
 *     "override": null,      // Reset to system default
 *     "default": 30
 *   }
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
exports.deleteConfig = errors.async(async function (req, res) {
    const { tenant_org_id } = req.user;
    const { field } = req.params;

    const existing = await db.org_config.findByPk(tenant_org_id);
    if (!existing) {
        // No org config row exists, return all nulls
        return res.json(formatConfigResponse(null));
    }

    try {
        // Set the specified field to null (use system default)
        await existing.update({ [field]: null });
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

    // After update(), the instance is updated in memory
    return res.json(formatConfigResponse(existing));
});

'use strict';

const errors = require('../errors');
const db = require('../db');
const config = require('../config');

function formatConfigResponse(plan_retention_days, plan_warning_days) {
    return {
        data: {
            plan_retention_days,
            plan_warning_days,
            default_plan_retention_days: config.plan_retention.retentionDays,
            default_plan_warning_days: config.plan_retention.warningDays
        }
    };
}

exports.get = errors.async(async function (req, res) {
    const { tenant_org_id } = req.user;
    const orgConfig = await db.org_config.findByPk(tenant_org_id);

    return res.json(formatConfigResponse(
        orgConfig?.plan_retention_days ?? config.plan_retention.retentionDays,
        orgConfig?.plan_warning_days ?? config.plan_retention.warningDays
    ));
});

exports.patch = errors.async(async function (req, res) {
    const { tenant_org_id } = req.user;
    const body = req.body ?? {};
    const { plan_retention_days: bodyRetentionDays, plan_warning_days: bodyWarningDays } = body;
    const {
        retentionDays: defaultRetentionDays,
        warningDays: defaultWarningDays
    } = config.plan_retention;

    const existing = await db.org_config.findByPk(tenant_org_id);

    // For each field: use the request body when that property is not null or undefined,
    // otherwise use the existing value in the org_config row,
    // otherwise use config.plan_retention defaults.
    const plan_retention_days = bodyRetentionDays ?? existing?.plan_retention_days ?? defaultRetentionDays;
    const plan_warning_days = bodyWarningDays ?? existing?.plan_warning_days ?? defaultWarningDays;

    await db.org_config.upsert({
        org_id: tenant_org_id,
        plan_retention_days,
        plan_warning_days
    });

    return res.json(formatConfigResponse(plan_retention_days, plan_warning_days));
});

exports.deleteConfig = errors.async(async function (req, res) {
    const { tenant_org_id } = req.user;
    const { field } = req.params;
    const {
        retentionDays: defaultRetentionDays,
        warningDays: defaultWarningDays
    } = config.plan_retention;

    const existing = await db.org_config.findByPk(tenant_org_id);
    if (!existing) {
        return res.json(formatConfigResponse(defaultRetentionDays, defaultWarningDays));
    }

    const plan_retention_days = field === 'plan_retention_days' ? defaultRetentionDays : existing.plan_retention_days;
    const plan_warning_days = field === 'plan_warning_days' ? defaultWarningDays : existing.plan_warning_days;

    await existing.update({ plan_retention_days, plan_warning_days });

    return res.json(formatConfigResponse(plan_retention_days, plan_warning_days));
});

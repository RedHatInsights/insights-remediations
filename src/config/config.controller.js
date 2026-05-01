'use strict';

const errors = require('../errors');
const db = require('../db');
const config = require('../config');

function formatResponse(plan_retention_days, plan_warning_days) {
    return {
        data: {
            plan_retention_days,
            plan_warning_days
        }
    };
}

exports.requireOrgAdmin = function (req, res, next) {
    const { user, service_account: serviceAccount } = req.identity ?? {};

    if (user?.is_org_admin === true || serviceAccount?.is_org_admin === true) {
        return next();
    }

    return next(new errors.Forbidden('Organization admin access required'));
};

exports.get = errors.async(async function (req, res) {
    const org_id = req.user?.tenant_org_id || req.identity?.org_id;
    const orgConfig = await db.org_config.findByPk(org_id);

    return res.json(formatResponse(
        orgConfig?.plan_retention_days ?? config.plan_retention.retentionDays,
        orgConfig?.plan_warning_days ?? config.plan_retention.warningDays
    ));
});

exports.patch = errors.async(async function (req, res) {
    const org_id = req.user?.tenant_org_id || req.identity?.org_id;
    const body = req.body ?? {};
    const { plan_retention_days: bodyRetentionDays, plan_warning_days: bodyWarningDays } = body;

    const existing = await db.org_config.findByPk(org_id);
    const { retentionDays, warningDays } = config.plan_retention;

    // For each field: use the request body when that property is not null or undefined,
    // otherwise use the existing value in the org_config row,
    // otherwise use config.plan_retention defaults.
    const plan_retention_days = bodyRetentionDays ?? existing?.plan_retention_days ?? retentionDays;
    const plan_warning_days = bodyWarningDays ?? existing?.plan_warning_days ?? warningDays;

    await db.org_config.upsert({
        org_id,
        plan_retention_days,
        plan_warning_days
    });

    return res.json(formatResponse(plan_retention_days, plan_warning_days));
});

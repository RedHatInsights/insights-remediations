'use strict';

const _ = require('lodash');
const assert = require('assert');

const errors = require('../errors');
const advisor = require('../connectors/advisor');
const inventory = require('../connectors/inventory');

/*
 * For now this is a mock implementation
 */
exports.getDiagnosis = errors.async(async function (req, res) {
    const insightsId = req.params.system;
    const branchId = req.query.branch_id;

    // TODO:
    // 1) obtain system data from inventory
    // 2) verify the principal is allowed to read the current system
    // 3) get report details from advisor, vulnerabilities
    // 4) optimize based on req.swagger.params.remediation.value

    const systems = await inventory.getSystemsByInsightsId(insightsId, req);
    const sorted = _.orderBy(systems, ['updated'], ['desc']);

    if (!sorted.length) {
        return res.status(404).end();
    }

    const system = sorted[0];
    assert(system.tenant_org_id === req.identity.org_id);
    assert(system.insights_id === insightsId, system.insights_id);

    const advisorDiagnosis = await advisor.getDiagnosis(req, system.id, branchId);
    res.json({
        id: system.id,
        insights_id: system.insights_id,
        details: {
            ...advisorDiagnosis
        }
    });
});

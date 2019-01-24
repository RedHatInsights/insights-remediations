'use strict';

const _ = require('lodash');
const P = require('bluebird');

const errors = require('../errors');
const advisor = require('../connectors/advisor');
const inventory = require('../connectors/inventory');

/*
 * For now this is a mock implementation
 */
exports.getDiagnosis = errors.async(async function (req, res) {
    const systemId = req.swagger.params.system.value;

    // TODO:
    // 1) obtain system data from inventory
    // 2) verify the principal is allowed to read the current system
    // 3) get report details from advisor, vulnerabilities
    // 4) optimize based on req.swagger.params.remediation.value

    const [systems, advisorDiagnosis] = await P.all([
        inventory.getSystemDetailsBatch([systemId]),
        advisor.getDiagnosis(systemId)
    ]);

    if (!_.has(systems, systemId)) {
        return res.status(404).end();
    }

    res.json({
        details: {
            ...advisorDiagnosis
        }
    });
});

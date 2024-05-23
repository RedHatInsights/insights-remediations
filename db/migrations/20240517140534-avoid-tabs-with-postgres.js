'use strict';

const _ = require('lodash');

// Fix remediation plan names that have leading/trailing tabs
//
// Something about the combination of Sequelize and postgres makes sql containing \t's behave unpredictably,
// so we're doing this migration again, the tedious way...
exports.up = async (q) => {
    // get list of remediation plans
    const [plans, metadata] = await q.sequelize.query("SELECT name, tenant_org_id, id FROM remediations;");

    // find plan names with leading/trailing tabs and strip them
    const re = /^\t|\t$/;
    const fixedPlans = _(plans)
        .filter(plan => {
            if (re.test(plan.name)) {
                plan.name = plan.name.trim();
                return true;
            }

            return false;
        })
        .value();

    // find plans that are duplicates due to the name change and make them unique
    for (const plan of fixedPlans) {
        // check for any matches
        if (_(plans).find({'name': plan.name}).value()) {
            // disambiguate by appending ' - 1' to plan name
            plan.name += ' - 1';
        }

        // update changed plans!
        await q.sequelize.query(`UPDATE remediations SET name = ${plan.name} WHERE id = ${plan.id};`);
    }
};

exports.down = async (q) => {
    // There is _still_ no going back...
};

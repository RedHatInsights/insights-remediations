'use strict';

const _ = require('lodash');

// Fix remediation plan names that have leading/trailing tabs
//
// Something about the combination of Sequelize and postgres makes sql containing \t's behave unpredictably,
// so we're doing this migration again, the tedious way...

exports.up = async (q) => {

    async function collides (plan_name, tenant_org_id) {
        const dups_sql = `SELECT name FROM remediations WHERE name = '${plan_name}' AND tenant_org_id = '${tenant_org_id}'`;
        const [dups] = await q.sequelize.query(dups_sql);

        return dups.length > 0;
    }

    // get list of remediation plans with leading / trailing tabs
    const target_sql = "SELECT name, tenant_org_id, id FROM remediations WHERE name like '\t%' OR name LIKE '%\t';";
    const [target_plans] = await q.sequelize.query(target_sql);

    for (const plan of target_plans) {
        // remove leading/trailing whitespace from target plan name
        plan.name = plan.name.trim();

        // check for collisions with existing plans
        let dup_count = 0;
        let new_name = plan.name;

        while (await collides(new_name, plan.tenant_org_id)) {
            dup_count++;
            new_name = plan.name + ` - ${dup_count}`;
        }

        // update plan name
        const update_sql = `UPDATE remediations SET name = '${new_name}' WHERE id = '${plan.id}';`;
        await q.sequelize.query(update_sql);
    }
};

exports.down = async (q) => {
    // There is _still_ no going back...
};

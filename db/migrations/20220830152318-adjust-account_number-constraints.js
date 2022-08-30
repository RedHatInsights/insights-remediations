'use strict';

const _ = require("lodash");
const bop = require("../../src/connectors/bop");
module.exports = {
    up: async (q, {STRING, TEXT}) => {
        // remove NOT NULL constraint from account_number
        q.changeColumn('remediations', 'account_number', {type: STRING, allowNull: true});
        q.changeColumn('playbook_archive', 'account_number', {type: STRING, allowNull: true});

        //===================================================
        // populate tenant_org_id for remediations table
        //===================================================
        {
            // get unique account numbers
            const query = "SELECT DISTINCT account_number FROM remediations WHERE tenant_org_id IS NULL";
            const [results, metadata] = await q.sequelize.query(query);
            const EBS_accounts = _(results).map('account_number').value();

            // get tenant_org_id map
            const org_ids = await bop.getTenantOrgIds(EBS_accounts);

            // populate tenant_org_id
            let p = [];

            for (const account in org_ids) {
                const query = `UPDATE remediations SET tenant_org_id = '${org_ids[account]}' WHERE account_number = '${account}' AND tenant_org_id IS NULL`
                p.push(q.sequelize.query(query));
            }

            Promise.all(p).then(() => {
                // add NOT NULL constraint to tenant_org_id
                q.changeColumn('remediations', 'tenant_org_id', {type: TEXT, allowNull: false});
            });
        }

        //===================================================
        // populate tenant_org_id for playbook_archive table
        //===================================================
        {
            // get unique account numbers
            const query = "SELECT DISTINCT account_number FROM playbook_archive WHERE tenant_org_id IS NULL";
            const [results, metadata] = await q.sequelize.query(query);
            const EBS_accounts = _(results).map('account_number').value();

            // get tenant_org_id map
            const org_ids = await bop.getTenantOrgIds(EBS_accounts);

            // populate tenant_org_id
            let p = [];

            for (const account in org_ids) {
                const query = `UPDATE playbook_archive SET tenant_org_id = '${org_ids[account]}' WHERE account_number = '${account}' AND tenant_org_id IS NULL`
                p.push(q.sequelize.query(query));
            }

            Promise.all(p).then(() => {
                // add NOT NULL constraint to tenant_org_id
                q.changeColumn('playbook_archive', 'tenant_org_id', {type: TEXT, allowNull: false});
            });
        }
    },

    down: (q, Sequelize) => {
        // remove NOT NULL constraint from tenant_org_id
        q.changeColumn('remediations', 'tenant_org_id', {type: STRING, allowNull: true});
        q.changeColumn('playbook_archive', 'tenant_org_id', {type: STRING, allowNull: true});

        // add NOT NULL constraint to account_number
        q.changeColumn('remediations', 'account_number', {type: STRING, allowNull: false});
        q.changeColumn('playbook_archive', 'account_number', {type: STRING, allowNull: false});
   }
};

'use strict';

const _ = require('lodash');
const bop = require('../../src/connectors/bop');

const BATCH_SIZE = 50;

module.exports = {
  up: async (q, Sequelize) => {
    //===================================================
    // populate tenant_org_id for remediations table
    //===================================================
    {
      // get unique account numbers
      const query = "SELECT DISTINCT account_number FROM remediations WHERE tenant_org_id IS NULL";
      const [results, metadata] = await q.sequelize.query(query);
      const EBS_batch_accounts = _(results).map('account_number').chunk(BATCH_SIZE).value();


      // batch org_id lookups....
      for (let EBS_accounts of EBS_batch_accounts) {
        // get tenant_org_id map
        const org_ids = await bop.getTenantOrgIds(EBS_accounts);

        // populate tenant_org_id
        for (const account in org_ids) {
          const query = `UPDATE remediations SET tenant_org_id = '${org_ids[account]}' WHERE account_number = '${account}'`
          q.sequelize.query(query);
        }
      }
    }

    //===================================================
    // populate tenant_org_id for playbook_archive table
    //===================================================
    {
      // get unique account numbers
      const query = "SELECT DISTINCT account_number FROM playbook_archive WHERE tenant_org_id IS NULL";
      const [results, metadata] = await q.sequelize.query(query);
      const EBS_batch_accounts = _(results).map('account_number').chunk(BATCH_SIZE).value();

      // batch org_id lookuos...
      for (let EBS_accounts of EBS_batch_accounts) {
        // get tenant_org_id map
        const org_ids = await bop.getTenantOrgIds(EBS_accounts);

        // populate tenant_org_id
        for (const account in org_ids) {
          const query = `UPDATE playbook_archive SET tenant_org_id = '${org_ids[account]}' WHERE account_number = '${account}'`
          q.sequelize.query(query);
        }
      }
    }
  },

  down: async (q, Sequelize) => {
    //===================================================
    // zero out tenant_org_id for remediations table
    //===================================================
    q.sequelize.query("UPDATE remediations SET tenant_org_id = NULL")

    //===================================================
    // zero out tenant_org_id for playbook_archive table
    //===================================================
    q.sequelize.query("UPDATE playbook_archive SET tenant_org_id = NULL")
  }
};

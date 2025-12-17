'use strict';

const _ = require('lodash');

const BATCH_SIZE = 100;

module.exports = {
  async up(q, Sequelize) {
    //===================================================
    // Populate missing systems from remediation plans
    //===================================================
    const inventory = require('../../src/connectors/inventory');
    
    // Fetch missing system details from inventory service and store in systems table
    async function fetch_missing_system_data(missingIds) {
      const systemDetails = await inventory.getSystemDetailsBatch(missingIds);
      const remediationSystems = Object.values(systemDetails).map(system => ({
        id: system.id,
        hostname: system.hostname || null,
        display_name: system.display_name || null,
        ansible_hostname: system.ansible_host || null
      }));

      if (remediationSystems.length > 0) {
        await q.bulkInsert('systems', remediationSystems, {
          updateOnDuplicate: ['hostname', 'display_name', 'ansible_hostname', 'updated_at']
        });
      }
    }

    try {
      // Get all distinct system IDs from all remediation plans
      const [results] = await q.sequelize.query(`
        SELECT DISTINCT system_id
        FROM remediation_issue_systems
      `);
      
      const distinctSystemIds = results.map(r => r.system_id);

      // Check which systems already exist in the systems table
      if (distinctSystemIds.length > 0) {
        // Process systems in batches to avoid huge IN clauses
        const chunks = _.chunk(distinctSystemIds, BATCH_SIZE);

        for (const chunk of chunks) {
          const [existingResults] = await q.sequelize.query(`
            SELECT id FROM systems WHERE id IN (${chunk.map(() => '?').join(',')})
          `, {
            replacements: chunk
          });
          
          const existingIds = existingResults.map(s => s.id);
          const missingIds = _.difference(chunk, existingIds);

          if (missingIds.length > 0) {
            await fetch_missing_system_data(missingIds);
          }
        }
      }

    } catch (error) {
      console.error('Migration failed:', error.message);
      console.error('Stack trace:', error.stack);
      throw error;
    }
  },

  async down() {
    // we're only adding data so we don't need to do anything on rollback
  },
  
  transaction: false
};
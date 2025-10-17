'use strict';

const _ = require('lodash');

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
        ansible_hostname: system.ansible_host || null,
        created_at: new Date(),
        updated_at: new Date()
      }));

      if (remediationSystems.length > 0) {
        // Insert missing systems into the systems table
        const values = remediationSystems.map(system => 
          `('${system.id}', ${system.hostname ? `'${system.hostname}'` : 'NULL'}, ${system.display_name ? `'${system.display_name}'` : 'NULL'}, ${system.ansible_hostname ? `'${system.ansible_hostname}'` : 'NULL'}, '${system.created_at.toISOString()}', '${system.updated_at.toISOString()}')`
        ).join(', ');
        
        const insertQuery = `
          INSERT INTO systems (id, hostname, display_name, ansible_hostname, created_at, updated_at)
          VALUES ${values}
          ON CONFLICT (id) DO UPDATE SET
            hostname = EXCLUDED.hostname,
            display_name = EXCLUDED.display_name,
            ansible_hostname = EXCLUDED.ansible_hostname,
            updated_at = EXCLUDED.updated_at
        `;
        
        await q.sequelize.query(insertQuery);
      }
    }

    try {
      // Get all distinct system IDs from all remediation plans
      const [results] = await q.sequelize.query(`
        SELECT DISTINCT ris.system_id
        FROM remediation_issue_systems ris
        INNER JOIN remediation_issues ri ON ris.remediation_issue_id = ri.id
        INNER JOIN remediations r ON ri.remediation_id = r.id
      `);
      
      const distinctSystemIds = results.map(r => r.system_id);

      // Check which systems already exist in the systems table
      if (distinctSystemIds.length > 0) {
        const [existingResults] = await q.sequelize.query(`
          SELECT id FROM systems WHERE id IN (${distinctSystemIds.map(() => '?').join(',')})
        `, {
          replacements: distinctSystemIds
        });
        
        const existingIds = existingResults.map(s => s.id);
        const missingIds = _.difference(distinctSystemIds, existingIds);

        if (missingIds.length > 0) {
          await fetch_missing_system_data(missingIds);
          console.log('Successfully populated missing systems');
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
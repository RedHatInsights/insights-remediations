'use strict';

const _ = require('lodash');

module.exports = {
  async up() {
    //===================================================
    // Populate missing systems from remediation plans
    //===================================================
    const db = require('../../src/db');
    const inventory = require('../../src/connectors/inventory');
    const { Op, s: { col }, fn: { DISTINCT }, issue, issue_system, remediation } = db;
    
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
        await db.systems.bulkCreate(remediationSystems, {
          updateOnDuplicate: ['hostname', 'display_name', 'ansible_hostname', 'updated_at']
        });
      }
    }

    try {
      // Get all distinct system IDs from all remediation plans   
      const distinctSystemIds = (await issue_system.findAll({
        attributes: [[DISTINCT(col('issue_system.system_id')), 'system_id']],
        include: [{
          model: issue,
          required: true,
          include: [{
            model: remediation,
            required: true
          }]
        }],
        raw: true
      })).map(r => r.system_id);

      // Check which systems already exist in the systems table
      const existingSystems = await db.systems.findAll({
        attributes: ['id'],
        where: { id: { [Op.in]: distinctSystemIds } },
        raw: true
      });

      const existingIds = existingSystems.map(s => s.id);
      const missingIds = _.difference(distinctSystemIds, existingIds);

      if (missingIds.length > 0) {
        await fetch_missing_system_data(missingIds);
        console.log('Successfully populated missing systems');
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
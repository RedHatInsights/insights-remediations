'use strict';

module.exports = {
  up: async (q, {TEXT}) => {
    // add tenant_org_id colum to remediations table
    q.addColumn('remediations', 'tenant_org_id', {
      type: TEXT,
      allowNull: true,
      defaultValue: null
    });

    // add tenant_org_id colum to playbook_archive table
    q.addColumn('playbook_archive', 'tenant_org_id', {
      type: TEXT,
      allowNull: true,
      defaultValue: null
    });
  },

  down: async (q) => {
    // remove tenant_org_id from remediations table
    q.removeColumn('remediatipns', 'tenant_org_id');

    // remove tenant_org_id from playbook_archive table
    q.removeColumn('playbook_archive', 'tenant_org_id');
  }
};

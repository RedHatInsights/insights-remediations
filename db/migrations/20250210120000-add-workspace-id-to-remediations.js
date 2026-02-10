'use strict';

module.exports = {
  up: async (q, {STRING}) => {
    await q.addColumn('remediations', 'workspace_id', {
      type: STRING,
      allowNull: true,
      defaultValue: null
    });
  },

  down: async (q) => {
    await q.removeColumn('remediations', 'workspace_id');
  }
};

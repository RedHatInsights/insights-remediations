'use strict';

const WORKSPACE_ID_INDEX = 'remediations_workspace_id_idx';

module.exports = {
  up: async (q, {STRING}) => {
    await q.addColumn('remediations', 'workspace_id', {
      type: STRING,
      allowNull: true,
      defaultValue: null
    });
    await q.addIndex('remediations', ['workspace_id'], {
      name: WORKSPACE_ID_INDEX
    });
  },

  down: async (q) => {
    await q.removeIndex('remediations', WORKSPACE_ID_INDEX);
    await q.removeColumn('remediations', 'workspace_id');
  }
};

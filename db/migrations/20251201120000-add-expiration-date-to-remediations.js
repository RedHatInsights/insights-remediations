'use strict';

module.exports = {
  up: async (q, {DATE}) => {
    await q.addColumn('remediations', 'expiration_date', {
      type: DATE,
      allowNull: true,
      defaultValue: null
    });
  },

  down: async (q) => {
    await q.removeColumn('remediations', 'expiration_date');
  }
};

'use strict';

const EXPIRATION_DATE_INDEX = 'remediations_expiration_date_idx';

module.exports = {
  up: async (q, {DATE}) => {
    await q.addColumn('remediations', 'expiration_date', {
      type: DATE,
      allowNull: true,
      defaultValue: null
    });
    await q.addIndex('remediations', ['expiration_date'], {
      name: EXPIRATION_DATE_INDEX
    });
  },

  down: async (q) => {
    await q.removeIndex('remediations', EXPIRATION_DATE_INDEX);
    await q.removeColumn('remediations', 'expiration_date');
  }
};

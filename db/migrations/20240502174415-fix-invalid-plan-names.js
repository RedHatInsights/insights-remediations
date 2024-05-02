'use strict';

module.exports = {
  up: async (q, {STRING}) => {
    // Fix plan names of the form " - 1"
    const fix_invalid_names = "UPDATE remediations SET name = 'Blank' || name WHERE name LIKE ' %';";

    await q.sequelize.query(fix_invalid_names);
  },

  down: async (q, Sequelize) => {
    // there is no meaningful reset for this migration
  }
};

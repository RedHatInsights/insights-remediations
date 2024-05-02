'use strict';

module.exports = {
  up: async (q, {STRING}) => {
    // Fix plan names of the form " - 1"
    const fix_blank_names = "UPDATE remediations SET name = 'Blank' || name WHERE name LIKE ' -%';";
    await q.sequelize.query(fix_blank_names);

    // remove leading blanks from plan names
    const remove_spaces = "UPDATE remediations SET name = TRIM(name) WHERE name LIKE ' %';";
    await q.sequelize.query(remove_spaces);
  },

  down: async (q, Sequelize) => {
    // there is no meaningful reset for this migration
  }
};

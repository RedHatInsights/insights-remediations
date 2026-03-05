'use strict';

const config = require('../../src/config');

const EXPIRATION_DATE_INDEX = 'remediations_expiration_date_idx';

module.exports = {
  up: async (q, {DATE}) => {
    const retentionDays = config.planRetentionDays;
    const batchSize = config.migrationBackfillBatchSize;

    await q.addColumn('remediations', 'expiration_date', {
      type: DATE,
      allowNull: true
    });

    // Backfill in batches to avoid holding row locks for the entire table and to reduce risk of timeouts.
    let rowCount;
    do {
      const [rows] = await q.sequelize.query(
        `UPDATE remediations
         SET expiration_date = created_at + :days * INTERVAL '1 day'
         WHERE id IN (
           SELECT id FROM remediations WHERE expiration_date IS NULL LIMIT ${batchSize}
         )
         RETURNING id`,
        { replacements: { days: retentionDays } }
      );
      rowCount = Array.isArray(rows) ? rows.length : 0;
    } while (rowCount > 0);

    await q.changeColumn('remediations', 'expiration_date', {
      type: DATE,
      allowNull: false
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

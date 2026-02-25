'use strict';

const EXPIRATION_DATE_INDEX = 'remediations_expiration_date_idx';

// Matches PR 972 / config.remediationRetentionDays default (REMEDIATION_RETENTION_DAYS). Kept here so migration
// works before that PR is merged; after rebase the behavior aligns with config.
const DEFAULT_RETENTION_DAYS = 270;

// Batch size for backfill to avoid long-running locks and timeouts on large tables.
const BACKFILL_BATCH_SIZE = 1000;

module.exports = {
  up: async (q, {DATE}) => {
    const retentionDays = parseInt(process.env.REMEDIATION_RETENTION_DAYS, 10) || DEFAULT_RETENTION_DAYS;

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
           SELECT id FROM remediations WHERE expiration_date IS NULL LIMIT ${BACKFILL_BATCH_SIZE}
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

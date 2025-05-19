'use strict';

module.exports = {
  down: async (q, Sequelize) => {
    // there is no meaningful reset for this migration
  },

  up: async (q, {STRING}) => {
    // Fix plan names that would be duplicates once TRIM()-ed
    const fix_dup_names = `
        WITH dups AS (
            SELECT b.name, b.id 
            FROM remediations a 
            JOIN (
                SELECT TRIM(name) AS name, id, tenant_org_id
                FROM remediations 
                WHERE name LIKE ' %' OR name LIKE '% '
            ) b 
            ON a.name = b.name AND a.tenant_org_id = b.tenant_org_id
        )
        UPDATE remediations
        SET name = dups.name || ' - 1'
        FROM dups
        WHERE dups.id = remediations.id;
    `;

    await q.sequelize.query(fix_dup_names);

    // trim remaining plan names
    const remove_spaces = `
        UPDATE remediations
        SET name = TRIM(name)
        WHERE name LIKE ' %' OR name LIKE '% ';
    `;

    await q.sequelize.query(remove_spaces);
  }
};

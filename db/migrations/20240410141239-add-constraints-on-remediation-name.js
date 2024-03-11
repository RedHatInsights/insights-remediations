'use strict';

module.exports = {
    up: async (q, {STRING}) => {
        // Find duplicate remediation names within an organization and append an incre
        // Example: 'duplicate name1', 'duplicate name2', 'duplicate name3'...
        const update_dups_in_org = `WITH dups AS (
                                        SELECT
                                            a.id,
                                            a.name,
                                            a.tenant_org_id,
                                            ROW_NUMBER() OVER (PARTITION BY a.tenant_org_id, a.name) AS number
                                        FROM remediations a
                                        JOIN (
                                            SELECT name, tenant_org_id
                                            FROM remediations
                                            GROUP BY name, tenant_org_id
                                            HAVING COUNT(*) > 1 OR name IS NULL
                                        ) b
                                        ON (a.name = b.name OR (a.name IS NULL AND b.name IS NULL)) AND a.tenant_org_id = b.tenant_org_id
                                    )
                                    UPDATE remediations
                                        SET name = coalesce(dups.name, 'Unnamed Remediation Plan') || ' - ' || dups.number
                                    FROM dups
                                    WHERE dups.id = remediations.id;`

        await q.sequelize.query(update_dups_in_org);

        // Add unique constraint to remediations name column based on tenant_org_id
        await q.addConstraint('remediations', {
            name: 'name_and_tenant_org_id',
            type: 'UNIQUE',
            fields: ['name', 'tenant_org_id']
        });

        // Add NOT NULL constraint to name
        // Fixing duplicates should make sure there are no NULL name values because either
        await q.changeColumn('remediations', 'name', {type: STRING, allowNull: false});
    },

    down: async (q, Sequelize) => {
          await q.removeConstraint('remediations', 'name_and_tenant_org_id');
          await q.changeColumn('remediations', 'name', {type: STRING, allowNull: true});
    }
};

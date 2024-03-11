'use strict';

module.exports = {
    up: async (q, {STRING}) => {
        //===================================================
        // This query will update existing remediation names to ensure that there are
        // no duplicate remediation names within an organization
        //===================================================

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
    },

    down: async (q, Sequelize) => {
    }
};

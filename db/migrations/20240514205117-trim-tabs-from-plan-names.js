'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(q, Sequelize) {
        // Fix plan names that would be duplicates once TRIM()-ed
        const remove_dup_tabs = `
            WITH dups AS (  
                SELECT a.name, b.id  
                FROM remediations a  
                JOIN (  
                    SELECT TRIM(TRIM('\\\\t' FROM name)) AS trimmed_name, id, tenant_org_id  
                    FROM remediations  
                    WHERE name LIKE '\\\\t%' OR name LIKE '%\\\\t'  
                ) b  
                ON a.name = b.trimmed_name AND a.tenant_org_id = b.tenant_org_id  
            )  
            UPDATE remediations  
            SET name = dups.name || ' - 1'  
            FROM dups  
            WHERE dups.id = remediations.id;
        `;

        await q.sequelize.query(remove_dup_tabs);

        // trim remaining plan names
        const remove_tabs = `
            WITH dups AS (
                SELECT TRIM(TRIM('\\\\t' FROM name)) AS trimmed_name, id
                FROM remediations
                WHERE name LIKE '\\\\t%' OR name LIKE '%\\\\t'
            )
            UPDATE remediations
            SET name = dups.trimmed_name
            FROM dups
            WHERE dups.id = remediations.id;
        `;

        await q.sequelize.query(remove_tabs);
    },

    async down(q, Sequelize) {
        // There is no turning back...
    }
};

exports.down = async (q) => {};

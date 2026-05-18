'use strict';

module.exports = {
    async up (q, {DATE, INTEGER, TEXT, fn}) {
        await q.createTable('org_config', {
            org_id: {
                type: TEXT,
                primaryKey: true,
                allowNull: false,
                comment: 'Organization ID'
            },
            plan_retention_days: {
                type: INTEGER,
                allowNull: false,
                defaultValue: 120,
                comment: 'Days of inactivity before remediation plan expiration'
            },
            plan_warning_days: {
                type: INTEGER,
                allowNull: false,
                defaultValue: 30,
                comment: 'Days before expiration to show warning'
            },
            created_at: {
                type: DATE,
                allowNull: false,
                defaultValue: fn('now')
            },
            updated_at: {
                type: DATE,
                allowNull: false,
                defaultValue: fn('now')
            }
        });
    },

    async down (q) {
        await q.dropTable('org_config');
    }
};

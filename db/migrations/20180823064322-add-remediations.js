'use strict';

module.exports = {
    async up (q, {DATE, INTEGER, fn, STRING, UUID}) {
        await q.createTable('remediations', {
            id: {
                type: UUID,
                primaryKey: true
            },
            name: {
                type: STRING
            },
            tenant: {
                type: STRING,
                allowNull: false
            },
            owner: {
                type: INTEGER,
                allowNull: false
            },
            created_at: {
                type: DATE,
                defaultValue: fn('now')
            },
            updated_at: DATE
        });
    },

    async down (q) {
        await q.dropTable('remediations');
    }
};

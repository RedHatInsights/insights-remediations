'use strict';

module.exports = {
    async up (q, {DATE, INTEGER, fn, STRING, TEXT}) {
        await q.createTable('playbook_archive', {
            id: {
                type: INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            username: {
                type: STRING,
                allowNull: false
            },
            account_number: {
                type: STRING,
                allowNull: false
            },
            filename: {
                type: STRING,
                allowNull: false
            },
            created_at: {
                type: DATE,
                allowNull: false,
                defaultValue: fn('now')
            },
            definition: {
                type: TEXT,
                allowNull: false
            }
        });

        await q.addIndex('playbook_archive', ['account_number'], {
            indexName: 'playbook_archive_account_number'
        });
    },

    async down (q) {
        return q.dropTable('playbook_archive');
    }
};

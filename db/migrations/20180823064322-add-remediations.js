'use strict';

module.exports = {
    async up (q, {BOOLEAN, DATE, INTEGER, fn, STRING, UUID}) {
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
                allowNull: false,
                defaultValue: fn('now')
            },
            updated_at: {
                type: DATE,
                defaultValue: fn('now')
            },
            auto_reboot: {
                type: BOOLEAN,
                allowNull: false,
                defaultValue: true
            }
        });

        await q.createTable('remediation_issues', {
            id: {
                type: INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            issue_id: {
                type: STRING,
                allowNull: false
            },
            remediation_id: {
                type: UUID,
                allowNull: false,
                references: {
                    model: 'remediations',
                    key: 'id'
                },
                onDelete: 'cascade',
                onUpdate: 'cascade'
            },
            resolution: {
                type: STRING,
                allowNull: true
            }
        });

        await q.addIndex('remediation_issues', ['remediation_id', 'issue_id'], {
            indexName: 'remediation_issue',
            indicesType: 'UNIQUE'
        });
    },

    async down (q) {
        await q.dropTable('remediation_issues');
        await q.dropTable('remediations');
    }
};

'use strict';

module.exports = {
    async up (q, {BOOLEAN, DATE, INTEGER, fn, STRING, UUID, ENUM}) {
        await q.createTable('dispatcher_runs', {
            dispatcher_run_id: {
                type: UUID,
                primaryKey: true
            },
            remediations_run_id: {
                type: UUID,
                allowNull: false,
                references: {
                    model: 'playbook_runs',
                    key: 'id'
                }
            },
            status: {
                type: ENUM,
                values: ['pending', 'running', 'success', 'failure', 'canceled', 'timeout'],
                defaultValue: 'pending',
                allowNull: false
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
        await q.dropTable('dispatcher_runs');
    }
};

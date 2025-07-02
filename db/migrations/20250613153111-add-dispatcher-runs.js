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
                },
                onDelete: 'cascade',
                onUpdate: 'cascade'
            },
            status: {
                type: ENUM,
                values: ['pending', 'running', 'success', 'failure', 'canceled', 'timeout'],
                defaultValue: 'pending',
                allowNull: false
            },
            pd_response_code: {
                type: INTEGER,
                allowNull: true,
                comment: 'HTTP response code from playbook-dispatcher when creating the run'
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

        // Add indexes for performance
        await q.addIndex('dispatcher_runs', ['remediations_run_id'], {
            name: 'dispatcher_runs_remediations_run_id'
        });

        await q.addIndex('dispatcher_runs', ['status'], {
            name: 'dispatcher_runs_status'
        });

        // Composite index for common queries
        await q.addIndex('dispatcher_runs', ['remediations_run_id', 'status'], {
            name: 'dispatcher_runs_remediation_status'
        });
    },

    async down (q) {
        // Remove indexes first, then drop table
        await q.removeIndex('dispatcher_runs', ['remediations_run_id', 'status']);
        await q.removeIndex('dispatcher_runs', ['status']);
        await q.removeIndex('dispatcher_runs', ['remediations_run_id']);
        await q.dropTable('dispatcher_runs');
    }
};

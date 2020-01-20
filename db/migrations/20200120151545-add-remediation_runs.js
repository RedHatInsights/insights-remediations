'use strict';

module.exports = {
    async up (q, {DATE, UUID, STRING, ENUM, INTEGER, TEXT, fn}) {
        await q.createTable('playbook_runs', {
            id: {
                type: UUID,
                primaryKey: true
            },
            status: {
                type: ENUM,
                values: ['pending', 'acked', 'running', 'success', 'failure', 'canceled'],
                defaultValue: 'pending',
                allowNull: false
            },
            remediation_id: {
                type: UUID,
                allowNull: false,
                references: {
                    model: 'remediations',
                    key: 'id'
                }
            },
            created_by: {
                type: STRING,
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

        await q.createTable('playbook_run_executors', {
            id: {
                type: UUID,
                primaryKey: true
            },
            executor_id: {
                type: UUID,
                allowNull: false
            },
            executor_name: {
                type: STRING,
                allowNull: false
            },
            receptor_node_id: {
                type: UUID,
                allowNull: false
            },
            receptor_job_id: {
                type: STRING,
                allowNull: false
            },
            status: {
                type: ENUM,
                values: ['pending', 'acked', 'running', 'success', 'failure', 'canceled'],
                defaultValue: 'pending',
                allowNull: false
            },
            updated_at: {
                type: DATE,
                defaultValue: fn('now'),
                allowNull: false
            },
            playbook: {
                type: TEXT,
                allowNull: false
            },
            playbook_run_id: {
                type: UUID,
                allowNull: false,
                references: {
                    model: 'playbook_runs',
                    key: 'id'
                }
            }
        });

        await q.createTable('playbook_run_systems', {
            id: {
                type: UUID,
                primaryKey: true,
                allowNull: false
            },
            system_id: {
                type: UUID,
                allowNull: false
            },
            system_name: {
                type: STRING,
                allowNull: false
            },
            status: {
                type: ENUM,
                values: ['pending', 'running', 'success', 'failure', 'canceled'],
                defaultValue: 'pending',
                allowNull: false
            },
            sequence: {
                type: INTEGER,
                allowNull: false,
                defaultValue: -1
            },
            console: {
                type: TEXT,
                allowNull: false
            },
            updated_at: {
                type: DATE,
                defaultValue: fn('now'),
                allowNull: false
            },
            playbook_run_executor_id: {
                type: UUID,
                allowNull: false,
                references: {
                    model: 'playbook_run_executors',
                    key: 'id'
                }
            }
        });
    },

    async down (q) {
        await q.dropTable('playbook_run_systems');
        await q.dropTable('playbook_run_executors');
        await q.dropTable('playbook_runs');
    }
};

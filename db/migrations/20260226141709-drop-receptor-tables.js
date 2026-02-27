'use strict';

module.exports = {
    async up (q) {
        await q.dropTable('playbook_run_systems');
        await q.dropTable('playbook_run_executors');
    },

    async down (q, { UUID, STRING, DATE, ENUM, TEXT, BOOLEAN, INTEGER, fn }) {
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
                type: STRING,
                allowNull: false
            },
            receptor_job_id: {
                type: UUID,
                allowNull: true
            },
            status: {
                type: ENUM,
                values: ['pending', 'running', 'success', 'failure', 'canceled', 'timeout'],
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
                },
                onUpdate: 'cascade',
                onDelete: 'cascade'
            },
            text_update_full: {
                type: BOOLEAN,
                allowNull: false,
                defaultValue: true
            },
            satellite_connection_code: {
                type: INTEGER,
                allowNull: true,
                defaultValue: null
            },
            satellite_infrastructure_code: {
                type: INTEGER,
                allowNull: true,
                defaultValue: null
            },
            satellite_connection_error: {
                type: STRING,
                allowNull: true,
                defaultValue: null
            },
            satellite_infrastructure_error: {
                type: STRING,
                allowNull: true,
                defaultValue: null
            }
        });

        await q.createTable('playbook_run_systems', {
            id: {
                type: UUID,
                primaryKey: true
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
                values: ['pending', 'running', 'success', 'failure', 'canceled', 'timeout'],
                defaultValue: 'pending',
                allowNull: false
            },
            sequence: {
                type: INTEGER,
                defaultValue: -1,
                allowNull: false
            },
            console: {
                type: TEXT,
                allowNull: false,
                defaultValue: ''
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
                },
                onUpdate: 'cascade',
                onDelete: 'cascade'
            },
            connection_code: {
                type: INTEGER,
                allowNull: true,
                defaultValue: null
            },
            execution_code: {
                type: INTEGER,
                allowNull: true,
                defaultValue: null
            }
        });
    }
};

'use strict';

module.exports = (sequelize, {STRING, UUID, ENUM, DATE, TEXT, BOOLEAN, INTEGER}) => {
    const RunExecutors = sequelize.define('playbook_run_executors', {
        id: {
            type: UUID,
            primaryKey: true,
            allowNull: false
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
            type: String,
            allowNull: false
        },
        receptor_job_id: {
            type: UUID,
            allowNull: true
        },
        status: {
            type: ENUM,
            values: ['pending', 'running', 'success', 'failure', 'canceled', 'acked'],
            defaultValue: 'pending',
            allowNull: false
        },
        updated_at: {
            type: DATE,
            allowNull: false
        },
        playbook: {
            type: TEXT,
            allowNull: false
        },
        playbook_run_id: {
            type: UUID,
            allowNull: false
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
    }, {
        timestamps: true,
        updatedAt: 'updated_at',
        createdAt: false
    });

    RunExecutors.associate = models => {
        RunExecutors.belongsTo(models.playbook_runs, {
            foreignKey: 'playbook_run_id'
        });

        RunExecutors.hasMany(models.playbook_run_systems, {
            foreignKey: 'playbook_run_executor_id',
            as: 'systems'
        });
    };

    return RunExecutors;
};

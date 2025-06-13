'use strict';

module.exports = (sequelize, {UUID, ENUM, STRING, DATE, TEXT, INTEGER}) => {
    const RunSystems = sequelize.define('playbook_run_systems', {
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
            allowNull: false,
            defaultValue: -1
        },
        console: {
            type: TEXT,
            allowNull: false,
            defaultValue: ''
        },
        updated_at: {
            type: DATE,
            allwoNull: false
        },
        playbook_run_executor_id: {
            type: UUID,
            allowNull: false
        }
    }, {
        timestamps: true,
        updatedAt: 'updated_at',
        createdAt: false
    });

    RunSystems.associate = models => {
        RunSystems.belongsTo(models.playbook_run_executors, {
            foreignKey: 'playbook_run_executor_id'
        });
    };

    return RunSystems;
};

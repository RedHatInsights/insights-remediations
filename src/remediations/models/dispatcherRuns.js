'use strict';

module.exports = (sequelize, { STRING, UUID, ENUM, DATE, INTEGER }) => {
    const DispatcherRuns = sequelize.define('dispatcher_runs', {
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
        pd_response_code: {
            type: INTEGER,
            allowNull: true
        },
        created_at: {
            type: DATE,
            allowNull: false
        },
        updated_at: {
            type: DATE,
            allowNull: false
        }
    }, {
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    DispatcherRuns.associate = models => {
        DispatcherRuns.belongsTo(models.playbook_runs, {
            foreignKey: 'remediations_run_id',
            as: 'playbook_run'
        });
    };

    return DispatcherRuns;
};

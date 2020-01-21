'use strict';

module.exports = (sequelize, {STRING, UUID, ENUM, DATE}) => {
    const RemediationRuns = sequelize.define('playbook_runs', {
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
            allowNull: false
        },
        created_by: {
            type: STRING,
            allowNull: false
        },
        created_at: {
            type: DATE,
            allowNullL: false
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

    RemediationRuns.associate = models => {
        RemediationRuns.belongsTo(models.remediation, {
            foreignKey: 'id'
        });

        RemediationRuns.hasMany(models.playbook_run_executors, {
            foreignKey: 'playbook_run_id'
        });
    };

    return RemediationRuns;
};

'use strict';

module.exports = (sequelize, {STRING, UUID, ENUM, DATE}) => {
    const PlaybookRuns = sequelize.define('playbook_runs', {
        id: {
            type: UUID,
            primaryKey: true
        },
        status: {
            type: ENUM,
            values: ['pending', 'running', 'success', 'failure', 'canceled', 'timeout'],
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

    PlaybookRuns.associate = models => {
        PlaybookRuns.belongsTo(models.remediation, {
            foreignKey: 'remediation_id'
        });

        PlaybookRuns.hasMany(models.dispatcher_runs, {
            foreignKey: 'remediations_run_id',
            as: 'dispatcher_runs',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });
    };

    return PlaybookRuns;
};

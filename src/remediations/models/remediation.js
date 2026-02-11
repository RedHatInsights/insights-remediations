'use strict';

const NULL_NAME_VALUE = 'Unnamed Playbook';

module.exports = (sequelize, {BOOLEAN, STRING, UUID, TEXT}) => {
    const Remediation = sequelize.define('remediation', {
        id: {
            type: UUID,
            primaryKey: true
        },
        name: {
            type: STRING,
            unique: 'name_and_tenant_org_id',
            allowNull: false
        },
        account_number: {
            type: STRING,
            allowNull: true
        },
        tenant_org_id: {
            type: TEXT,
            unique: 'name_and_tenant_org_id',
            allowNull: false
        },
        created_by: {
            type: STRING,
            allowNull: false
        },
        updated_by: {
            type: STRING,
            allowNull: false
        },
        auto_reboot: {
            type: BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        archived: {
            type: BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        workspace_id: {
            type: STRING,
            allowNull: true
        }
    }, {
        timestamps: true
    });

    Remediation.associate = models => {
        Remediation.hasMany(models.issue, {
            foreignKey: 'remediation_id'
        });

        Remediation.hasMany(models.playbook_runs, {
            foreignKey: 'remediation_id'
        });
    };

    return Remediation;
};

module.exports.NULL_NAME_VALUE = NULL_NAME_VALUE;

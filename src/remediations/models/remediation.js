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
            get() {
                const value = this.getDataValue('name');

                if (value === null) {
                    return NULL_NAME_VALUE;
                }

                return value;
            }
        },
        account_number: {
            type: STRING,
            allowNull: false
        },
        tenant_org_id: {
            type: TEXT,
            allowNull: true // TODO: fix this once org_id migration is complete
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

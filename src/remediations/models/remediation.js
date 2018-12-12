'use strict';

const { emptyStringOnNull } = require('../../util/models');

module.exports = (sequelize, {BOOLEAN, STRING, UUID}) => {
    const Remediation = sequelize.define('remediation', {
        id: {
            type: UUID,
            primaryKey: true
        },
        name: {
            type: STRING,
            get() {
                return emptyStringOnNull(this.getDataValue('name'));
            }
        },
        account_number: {
            type: STRING,
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
        }
    }, {
        timestamps: true
    });

    Remediation.associate = models => {
        Remediation.hasMany(models.issue, {
            foreignKey: 'remediation_id'
        });
    };

    return Remediation;
};

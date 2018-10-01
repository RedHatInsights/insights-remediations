'use strict';

const { emptyStringOnNull } = require('../../util/models');

module.exports = (sequelize, {INTEGER, STRING, UUID}) => {
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
        tenant: {
            type: STRING,
            allowNull: false
        },
        owner: {
            type: INTEGER,
            allowNull: false
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

'use strict';

const { emptyStringOnNull } = require('../../util/models');

module.exports = (sequelize, {INTEGER, STRING, UUID}) => {
    const Issue = sequelize.define('issue', {
        id: {
            type: INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        issue_id: {
            type: STRING,
            allowNull: false
        },
        remediation_id: {
            type: UUID,
            allowNull: false
        },
        resolution: {
            type: STRING,
            allowNull: true,
            get() {
                return emptyStringOnNull(this.getDataValue('resolution'));
            }
        }
    }, {
        tableName: 'remediation_issues'
    });

    Issue.associate = models => {
        Issue.belongsTo(models.remediation, {
            foreignKey: 'remediation_id'
        });

        Issue.belongsToMany(models.system, {
            foreignKey: 'remediation_issue_id',
            through: 'remediation_issue_systems'
        });
    };

    return Issue;
};

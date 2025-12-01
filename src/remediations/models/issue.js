'use strict';

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
            allowNull: true
        },
        precedence: {
            type: INTEGER,
            allowNull: true,
            defaultValue: null
        }
    }, {
        tableName: 'remediation_issues'
    });

    Issue.associate = models => {
        Issue.belongsTo(models.remediation, {
            foreignKey: 'remediation_id'
        });

        Issue.hasMany(models.issue_system, {
            foreignKey: 'remediation_issue_id',
            as: 'systems'
        });
    };

    return Issue;
};

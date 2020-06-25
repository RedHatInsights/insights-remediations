'use strict';

module.exports = (sequelize, {INTEGER, UUID, BOOLEAN}) => {
    const IssueSystem = sequelize.define('issue_system', {
        remediation_issue_id: {
            type: INTEGER,
            primaryKey: true
        },
        system_id: {
            type: UUID,
            primaryKey: true
        },
        resolved: {
            type: BOOLEAN,
            allowNull: false,
            defaultValue: false
        }
    }, {
        tableName: 'remediation_issue_systems'
    });

    IssueSystem.associate = models => {
        IssueSystem.belongsTo(models.issue, {
            foreignKey: 'remediation_issue_id'
        });
    };

    return IssueSystem;
};

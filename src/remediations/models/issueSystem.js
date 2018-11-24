'use strict';

module.exports = (sequelize, {INTEGER, UUID}) => {
    const IssueSystem = sequelize.define('issue_system', {
        remediation_issue_id: {
            type: INTEGER,
            primaryKey: true
        },
        system_id: {
            type: UUID,
            primaryKey: true
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

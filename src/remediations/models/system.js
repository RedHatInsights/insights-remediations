'use strict';

module.exports = (sequelize, {UUID}) => {
    const System = sequelize.define('system', {
        id: {
            type: UUID,
            primaryKey: true
        }
    });

    System.associate = models => {
        System.belongsToMany(models.issue, {
            foreignKey: 'system_id',
            through: 'remediation_issue_systems'
        });
    };

    return System;
};

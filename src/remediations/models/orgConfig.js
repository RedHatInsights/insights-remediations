'use strict';

module.exports = (sequelize, {DATE, INTEGER, TEXT}) => {
    const OrgConfig = sequelize.define('org_config', {
        org_id: {
            type: TEXT,
            primaryKey: true,
            allowNull: false
        },
        retention_period_days: {
            type: INTEGER,
            allowNull: false
        },
        retention_warning_days: {
            type: INTEGER,
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

    return OrgConfig;
};

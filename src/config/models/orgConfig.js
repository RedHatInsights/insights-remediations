'use strict';

const config = require('../../config');

module.exports = (sequelize, {DATE, INTEGER, TEXT}) => {
    const OrgConfig = sequelize.define('org_config', {
        org_id: {
            type: TEXT,
            primaryKey: true,
            allowNull: false
        },
        plan_retention_days: {
            type: INTEGER,
            allowNull: true,  // null = use system default, non-null = custom override
            validate: {
                isValidWithWarning(value) {
                    const retention = value ?? config.plan_retention.retentionDays;
                    const warning = this.plan_warning_days ?? config.plan_retention.warningDays;

                    if (warning >= retention) {
                        throw new Error(`Warning period (${warning} days) must be less than retention period (${retention} days)`);
                    }
                }
            }
        },
        plan_warning_days: {
            type: INTEGER,
            allowNull: true,  // null = use system default, non-null = custom override
            validate: {
                isValidWithRetention(value) {
                    const warning = value ?? config.plan_retention.warningDays;
                    const retention = this.plan_retention_days ?? config.plan_retention.retentionDays;

                    if (warning >= retention) {
                        throw new Error(`Warning period (${warning} days) must be less than retention period (${retention} days)`);
                    }
                }
            }
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
        tableName: 'org_config',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    return OrgConfig;
};

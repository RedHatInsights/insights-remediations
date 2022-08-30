'use strict';

module.exports = (sequelize, {INTEGER, DATE, STRING, TEXT}) => {
    const PlaybookArchive = sequelize.define('PlaybookArchive', {
        id: {
            type: INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        username: {
            type: STRING,
            allowNull: false
        },
        account_number: {
            type: STRING,
            allowNull: true
        },
        tenant_org_id: {
            type: TEXT,
            allowNull: false
        },
        filename: {
            type: STRING,
            allowNull: false
        },
        created_at: DATE,
        definition: {
            type: TEXT,
            allowNull: false
        }
    }, {
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        tableName: 'playbook_archive'
    });

    return PlaybookArchive;
};

'use strict';

module.exports = (sequelize, {STRING, UUID}) => {
    const Systems = sequelize.define('systems', {
        id: {
            type: UUID,
            primaryKey: true
        },
        hostname: {
            type: STRING(255),
            allowNull: true
        },
        display_name: {
            type: STRING(255),
            allowNull: true
        },
        ansible_hostname: {
            type: STRING(255),
            allowNull: true
        }
    }, {
        timestamps: true
    });

    Systems.associate = models => {
    };

    return Systems;
}; 

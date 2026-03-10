'use strict';

/**
 * Systems table - caches system details from Host Based Inventory (HBI).
 * 
 * For satellite_org_id and owner_id, we use a null vs '' convention:
 *   null   → needs fetch from Inventory
 *   ''     → fetched, no value exists
 *   'xyz'  → actual value
 */
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
        },
        // See convention above: null = needs backfill, '' = not satellite, 'id' = satellite org
        satellite_org_id: {
            type: STRING(50),
            allowNull: true
        },
        // See convention above: null = needs backfill, '' = no owner, 'uuid' = owner ID
        owner_id: {
            type: STRING(50),
            allowNull: true
        }
    }, {
        timestamps: true
    });

    Systems.associate = models => {
    };

    return Systems;
}; 

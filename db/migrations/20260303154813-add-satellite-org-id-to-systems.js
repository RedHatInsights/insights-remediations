'use strict';

module.exports = {
    async up (q, {STRING}) {
        await q.addColumn('systems', 'satellite_org_id', {
            type: STRING(50),
            allowNull: true,
            comment: 'Satellite organization ID for the system (from HBI facts.satellite.organization_id)'
        });

        await q.addColumn('systems', 'owner_id', {
            type: STRING(50),
            allowNull: true,
            comment: 'System owner ID for cert-auth validation (from HBI system_profile.owner_id)'
        });
    },

    async down (q) {
        await q.removeColumn('systems', 'satellite_org_id');
        await q.removeColumn('systems', 'owner_id');
    }
};

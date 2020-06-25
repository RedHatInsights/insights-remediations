'use strict';

module.exports = {
    async up (q, {BOOLEAN}) {
        q.addColumn('remediation_issue_systems',
            'resolved', {
                type: BOOLEAN,
                allowNull: false,
                defaultValue: false
            }
        );
    },

    async down (q) {
        q.removeColumn('remediation_issue_systems', 'resolved');
    }
};

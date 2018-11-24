'use strict';

module.exports = {
    async up (q, {INTEGER, UUID}) {
        await q.createTable('remediation_issue_systems', {
            remediation_issue_id: {
                type: INTEGER,
                primaryKey: true,
                references: {
                    model: 'remediation_issues',
                    key: 'id'
                },
                onDelete: 'cascade',
                onUpdate: 'cascade'
            },
            system_id: {
                type: UUID,
                primaryKey: true
            }
        });
    },

    async down (q) {
        await q.dropTable('remediation_issue_systems');
    }
};

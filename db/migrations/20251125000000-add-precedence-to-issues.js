'use strict';

module.exports = {
    async up (q, {INTEGER}) {
        await q.addColumn('remediation_issues',
            'precedence', {
                type: INTEGER,
                allowNull: true,
                defaultValue: null
            }
        );

        await q.addIndex('remediation_issues', ['precedence', 'issue_id'], {
            name: 'remediation_issues_precedence_issue_id_idx'
        });
    },

    async down (q) {
        await q.removeIndex('remediation_issues', 'remediation_issues_precedence_issue_id_idx');
        await q.removeColumn('remediation_issues', 'precedence');
    }
};


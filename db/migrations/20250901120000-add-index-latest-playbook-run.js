'use strict';

module.exports = {
    async up (q) {
        await q.addIndex('playbook_runs', ['remediation_id', 'created_at', 'id'], {
            name: 'idx_pr_rem_created_id'
        });
    },

    async down (q) {
        await q.removeIndex('playbook_runs', 'idx_pr_rem_created_id');
    }
};



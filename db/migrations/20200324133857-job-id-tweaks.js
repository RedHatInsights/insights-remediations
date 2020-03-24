'use strict';

module.exports = {
    async up (q) {
        await q.addConstraint('playbook_run_executors', ['receptor_job_id'], {
            name: 'receptor_job_id',
            type: 'UNIQUE'
        });
    },

    async down (q) {
        await q.removeConstraint('playbook_run_executors', 'receptor_job_id');
    }
};

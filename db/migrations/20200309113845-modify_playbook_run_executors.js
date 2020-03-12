'use strict';

module.exports = {
    async up (q, {STRING}) {
        await q.changeColumn('playbook_run_executors',
            'receptor_job_id', {
                type: 'UUID USING CAST("receptor_job_id" as UUID)',
                allowNull: false
            }
        );

        await q.changeColumn('playbook_run_executors',
            'receptor_node_id', {
                type: STRING,
                allowNull: false
            }
        );
    },

    async down (q, {STRING}) {
        await q.changeColumn('playbook_run_executors',
            'receptor_job_id', {
                type: STRING,
                allowNull: false
            }
        );

        await q.changeColumn('playbook_run_executors',
            'receptor_node_id', {
                type: 'UUID USING CAST("receptor_job_id" as UUID)',
                allowNull: false
            }
        );
    }
};

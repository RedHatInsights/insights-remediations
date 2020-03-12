'use strict';

module.exports = {
    async up (q, {UUID, TEXT}) {
        await q.changeColumn('playbook_run_executors',
            'receptor_job_id', {
                type: UUID,
                allowNull: true
            }
        );

        await q.changeColumn('playbook_run_systems',
            'console', {
                type: TEXT,
                defaultValue: ''
            }
        );
    },

    async down (q, {UUID, STRING}) {
        await q.changeColumn('playbook_run_executors',
            'receptor_job_id', {
                type: UUID,
                allowNull: false
            }
        );

        await q.changeColumn('playbook_run_systems',
            'console', {
                type: STRING,
                defaultValue: null,
                allowNull: true
            }
        );
    }
};

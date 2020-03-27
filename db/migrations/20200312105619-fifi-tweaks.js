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
        q.sequelize.query(
            // just setting it to an arbitrary id so that it passes the NOT NULL constraint
            // eslint-disable-next-line max-len
            `UPDATE "playbook_run_executors" SET "receptor_job_id" = '7cfcf78f-6c17-4ceb-b839-022f8a47b7b1' WHERE "receptor_job_id" IS NULL`
        );

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

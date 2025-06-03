'use strict';

module.exports = {
    async up (q) {
        // Sequelize doesn't support altering ENUM types directly with a built-in method
        await q.sequelize.query(`ALTER TYPE "enum_playbook_runs_status" ADD VALUE IF NOT EXISTS 'timeout'`);
        await q.sequelize.query(`ALTER TYPE "enum_playbook_run_executors_status" ADD VALUE IF NOT EXISTS 'timeout'`);
        await q.sequelize.query(`ALTER TYPE "enum_playbook_run_systems_status" ADD VALUE IF NOT EXISTS 'timeout'`);
    },

    async down (q) {
        // Note: Postgres doesn't support removing enum values directly
        console.warn('Down migration not supported for ENUM modifications');
    }
};

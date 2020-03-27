/* eslint-disable max-len */
'use strict';

async function changeConstraint (q, table, column, targetTable, targetField, name, action) {
    await q.removeConstraint(table, name);
    await q.addConstraint(table, [column], {
        type: 'foreign key',
        name,
        references: {
            table: targetTable,
            field: targetField
        },
        onDelete: action,
        onUpdate: action
    });
}

module.exports = {
    async up (q) {
        await changeConstraint(
            q,
            'playbook_runs',
            'remediation_id',
            'remediations',
            'id',
            'playbook_runs_remediation_id_fkey',
            'cascade'
        );

        await changeConstraint(
            q,
            'playbook_run_executors',
            'playbook_run_id',
            'playbook_runs',
            'id',
            'playbook_run_executors_playbook_run_id_fkey',
            'cascade'
        );

        await changeConstraint(
            q,
            'playbook_run_systems',
            'playbook_run_executor_id',
            'playbook_run_executors',
            'id',
            'playbook_run_systems_playbook_run_executor_id_fkey',
            'cascade'
        );
    },

    async down (q) {
        await changeConstraint(
            q,
            'playbook_runs',
            'remediation_id',
            'remediations',
            'id',
            'playbook_runs_remediation_id_fkey',
            undefined
        );

        await changeConstraint(
            q,
            'playbook_run_executors',
            'playbook_run_id',
            'playbook_runs',
            'id',
            'playbook_run_executors_playbook_run_id_fkey',
            undefined
        );

        await changeConstraint(
            q,
            'playbook_run_systems',
            'playbook_run_executor_id',
            'playbook_run_executors',
            'id',
            'playbook_run_systems_playbook_run_executor_id_fkey',
            undefined
        );
    }
};

'use strict';

module.exports = {
    async up (q, {INTEGER, STRING}) {
        q.removeColumn('playbook_run_executors', 'connection_code');
        q.removeColumn('playbook_run_executors', 'execution_code');

        q.addColumn('playbook_run_executors',
            'satellite_connection_code', {
                type: INTEGER,
                values: [1, 0],
                allowNull: true,
                defaultValue: null
            }
        );

        q.addColumn('playbook_run_executors',
            'satellite_infrastructure_code', {
                type: INTEGER,
                values: [1, 0],
                allowNull: true,
                defaultValue: null
            }
        );

        q.addColumn('playbook_run_executors',
            'satellite_connection_error', {
                type: STRING,
                allowNull: true,
                defaultValue: null
            }
        );

        q.addColumn('playbook_run_executors',
            'satellite_infrastructure_error', {
                type: STRING,
                allowNull: true,
                defaultValue: null
            }
        );
    },

    async down (q, {INTEGER}) {
        q.addColumn('playbook_run_executors',
            'connection_code', {
                type: INTEGER,
                values: [1, 0],
                allowNull: true,
                defaultValue: null
            }
        );
        q.addColumn('playbook_run_executors',
            'execution_code', {
                type: INTEGER,
                allowNull: true,
                defaultValue: null
            }
        );

        q.removeColumn('playbook_run_executors', 'satellite_connection_code');
        q.removeColumn('playbook_run_executors', 'satellite_infrastructure_code');
        q.removeColumn('playbook_run_executors', 'satellite_connection_error');
        q.removeColumn('playbook_run_executors', 'satellite_infrastructure_error');
    }
};

'use strict';

module.exports = {
    async up (q, {INTEGER}) {
        q.addColumn('playbook_run_systems',
            'connection_code', {
                type: INTEGER,
                values: [1, 0],
                allowNull: true,
                defaultValue: null
            }
        );

        q.addColumn('playbook_run_systems',
            'execution_code', {
                type: INTEGER,
                allowNull: true,
                defaultValue: null
            }
        );
    },

    async down (q) {
        q.removeColumn('playbook_run_systems', 'connection_code');
        q.removeColumn('playbook_run_systems', 'execution_code');
    }
};

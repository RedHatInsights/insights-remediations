'use strict';

module.exports = {
    async up (q, {BOOLEAN}) {
        q.addColumn('playbook_run_executors',
            'text_update_full', {
                type: BOOLEAN,
                allowNull: false,
                defaultValue: true
            }
        );
    },

    async down (q) {
        q.removeColumn('playbook_run_executors', 'text_update_full');
    }
};

'use strict';

module.exports = {
    async up (q) {
        q.addIndex('playbook_run_systems', ['system_name']);
    },

    async down (q) {
        q.removeIndex('playbook_run_systems', ['system_name']);
    }
};

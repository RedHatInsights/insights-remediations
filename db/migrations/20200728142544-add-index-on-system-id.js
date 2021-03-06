'use strict';

module.exports = {
    async up (q) {
        q.addIndex('remediation_issue_systems', ['system_id']);
    },

    async down (q) {
        q.removeIndex('remediation_issue_systems', ['system_id']);
    }
};

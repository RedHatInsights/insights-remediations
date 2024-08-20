'use strict';

module.exports = {
  async up (q) {
    q.addIndex('remediation_issue_systems', ['remediation_issue_id', 'resolved']);
  },

  async down (q) {
    q.removeIndex('remediation_issue_systems', ['remediation_issue_id', 'resolved']);
  }
};

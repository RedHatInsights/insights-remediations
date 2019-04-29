'use strict';

module.exports = {
    async up (q) {
        await q.sequelize.query(`DELETE FROM remediation_issues WHERE issue_id LIKE 'compliance:%'`);
    },

    async down () {
        // no way back
    }
};

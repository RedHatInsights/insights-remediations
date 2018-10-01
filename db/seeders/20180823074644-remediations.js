'use strict';

module.exports = {
    async up (qi) {
        await qi.bulkInsert('remediations', [{
            id: '66eec356-dd06-4c72-a3b6-ef27d1508a02',
            name: 'remediation 1',
            tenant: '540155',
            owner: 1
        }, {
            id: 'cbc782e4-e8ae-4807-82ab-505387981d2e',
            name: 'remediation 2',
            tenant: '540155',
            owner: 1
        }, {
            id: 'e809526c-56f5-4cd8-a809-93328436ea23',
            name: null,
            tenant: '540155',
            owner: 1
        }, {
            id: 'e67118cc-28ec-4b55-afe9-2b5cfab24f13',
            name: 'to be deleted',
            tenant: '540155',
            owner: 1
        }]);

        await qi.bulkInsert('remediation_issues', [{
            issue_id: 'vulnerabilities:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074',
            remediation_id: '66eec356-dd06-4c72-a3b6-ef27d1508a02'
        }, {
            issue_id: 'vulnerabilities:CVE-2017-17713',
            remediation_id: '66eec356-dd06-4c72-a3b6-ef27d1508a02'
        }]);
    },

    down () {}
};

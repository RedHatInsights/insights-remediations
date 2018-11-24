'use strict';

const _ = require('lodash');

const tenant = 'testWrite';
const owner = 103;

const opts = {
    returning: true
};

exports.up = async q => {
    const remediations = await q.bulkInsert('remediations', [{
        id: '3d34ed5c-a71f-48ee-b7af-b215f27ae68d',
        name: 'to be deleted',
        tenant,
        owner
    }, {
        id: '3274d99f-511d-4b05-9d88-69934f6bb8ec',
        name: 'to have issue deleted',
        tenant,
        owner
    }], opts);

    const issues = await q.bulkInsert('remediation_issues', _.flatMap(remediations, remediation => [{
        remediation_id: remediation.id,
        issue_id: 'vulnerabilities:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074'
    }, {
        remediation_id: remediation.id,
        issue_id: 'vulnerabilities:CVE-2017-17713'
    }]), opts);

    await q.bulkInsert('remediation_issue_systems', issues.map(issue => ({
        system_id: '1bada2ce-e379-4e17-9569-8a22e09760af',
        remediation_issue_id: issue.id
    })));
};

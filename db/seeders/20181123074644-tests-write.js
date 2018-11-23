'use strict';

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
        owner,
        created_at: '2018-10-04T08:19:36.641Z',
        updated_at: '2018-10-04T08:19:36.641Z'
    }], opts);

    const systems = await q.bulkInsert('systems', [{
        id: '1bada2ce-e379-4e17-9569-8a22e09760af'
    }], opts);

    const issues = await q.bulkInsert('remediation_issues', [{
        remediation_id: remediations[0].id,
        issue_id: 'vulnerabilities:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074'
    }], opts);

    await q.bulkInsert('remediation_issue_systems', [{
        system_id: systems[0].id,
        remediation_issue_id: issues[0].id
    }]);
};

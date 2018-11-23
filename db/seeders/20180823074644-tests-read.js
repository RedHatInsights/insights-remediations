'use strict';

const tenant = 'test';
const owner = 100;

const opts = {
    returning: true
};

exports.up = async q => {
    const remediations = await q.bulkInsert('remediations', [{
        id: '66eec356-dd06-4c72-a3b6-ef27d1508a02',
        name: 'remediation 1',
        tenant,
        owner,
        created_at: '2018-10-04T08:19:36.641Z',
        updated_at: '2018-10-04T08:19:36.641Z'
    }, {
        id: 'cbc782e4-e8ae-4807-82ab-505387981d2e',
        name: 'remediation 2',
        tenant,
        owner,
        created_at: '2018-10-04T08:19:36.641Z',
        updated_at: '2018-10-04T08:19:36.641Z'
    }, {
        id: 'e809526c-56f5-4cd8-a809-93328436ea23',
        name: null,
        tenant,
        owner,
        created_at: '2018-10-04T08:19:36.641Z',
        updated_at: '2018-10-04T08:19:36.641Z'
    }], opts);

    const systems = await q.bulkInsert('systems', [{
        id: 'fc94beb8-21ee-403d-99b1-949ef7adb762'
    }, {
        id: '1f12bdfc-8267-492d-a930-92f498fe65b9'
    }], opts);

    const issues = await q.bulkInsert('remediation_issues', [{
        remediation_id: remediations[0].id,
        issue_id: 'vulnerabilities:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074'
    }, {
        remediation_id: remediations[0].id,
        issue_id: 'vulnerabilities:CVE-2017-17713'
    }, {
        remediation_id: remediations[0].id,
        issue_id: 'vulnerabilities:RHSA-2018:0502'
    }, {
        remediation_id: remediations[0].id,
        issue_id: 'advisor:bond_config_issue|BOND_CONFIG_ISSUE'
    }, {
        remediation_id: remediations[0].id,
        issue_id: 'compliance:sshd_disable_root_login'
    }], opts);

    await q.bulkInsert('remediation_issue_systems', [{
        system_id: systems[0].id,
        remediation_issue_id: issues[0].id
    }, {
        system_id: systems[0].id,
        remediation_issue_id: issues[1].id
    }, {
        system_id: systems[0].id,
        remediation_issue_id: issues[2].id
    }, {
        system_id: systems[0].id,
        remediation_issue_id: issues[3].id
    }, {
        system_id: systems[0].id,
        remediation_issue_id: issues[4].id
    }, {
        system_id: systems[1].id,
        remediation_issue_id: issues[0].id
    }]);
};

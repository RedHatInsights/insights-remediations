'use strict';

const { account_number, tenant_org_id, username: created_by } = require('../../src/connectors/users/mock').MOCK_USERS['tuser@redhat.com'];

const opts = {
    returning: true
};

const systems = [
    'fc94beb8-21ee-403d-99b1-949ef7adb762',
    '1f12bdfc-8267-492d-a930-92f498fe65b9'
];

exports.up = async q => {
    const remediations = await q.bulkInsert('remediations', [{
        id: '66eec356-dd06-4c72-a3b6-ef27d1508a02',
        name: 'Test1',
        auto_reboot: true,
        archived: true,
        account_number,
        tenant_org_id,
        created_by,
        created_at: '2018-10-04T08:19:36.641Z',
        updated_by: created_by,
        updated_at: '2018-10-04T08:19:36.641Z'
    }, {
        id: 'cbc782e4-e8ae-4807-82ab-505387981d2e',
        name: 'Test2',
        auto_reboot: true,
        account_number,
        tenant_org_id,
        archived: false,
        created_by,
        created_at: '2018-11-04T08:19:36.641Z',
        updated_by: created_by,
        updated_at: '2018-11-04T08:19:36.641Z'
    }, {
        id: 'e809526c-56f5-4cd8-a809-93328436ea23',
        name: 'Test3',
        auto_reboot: false,
        account_number,
        tenant_org_id,
        archived: false,
        created_by,
        created_at: '2018-12-04T08:19:36.641Z',
        updated_by: created_by,
        updated_at: '2018-12-04T08:19:36.641Z'
    }, {
        id: '178cf0c8-35dd-42a3-96d5-7b50f9d211f6',
        name: 'Remediation with suppressed reboot',
        auto_reboot: false,
        account_number,
        tenant_org_id,
        archived: true,
        created_by,
        created_at: '2018-12-05T08:19:36.641Z',
        updated_by: created_by,
        updated_at: '2018-12-05T08:19:36.641Z'
    }, {
        id: '256ab1d3-58cf-1292-35e6-1a49c8b122d3',
        name: 'Remediation with zero issues',
        auto_reboot: false,
        account_number,
        tenant_org_id,
        archived: false,
        created_by,
        created_at: '2018-12-06T08:19:36.641Z',
        updated_by: created_by,
        updated_at: '2018-12-06T08:19:36.641Z'
    }], opts);

    const issues = await q.bulkInsert('remediation_issues', [{
        remediation_id: remediations[0].id,
        issue_id: 'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074'
    }, {
        remediation_id: remediations[0].id,
        issue_id: 'vulnerabilities:CVE-2017-5715'
    }, {
        remediation_id: remediations[0].id,
        issue_id: 'vulnerabilities:RHSA-2018:0502'
    }, {
        remediation_id: remediations[0].id,
        issue_id: 'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE'
    }, {
        remediation_id: remediations[0].id,
        issue_id: 'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_service_autofs_disabled'
    }, {
        remediation_id: remediations[1].id,
        issue_id: 'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074'
    }, {
        remediation_id: remediations[1].id,
        issue_id: 'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE'
    }, {
        remediation_id: remediations[2].id,
        issue_id: 'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE'
    }, {
        remediation_id: remediations[3].id,
        issue_id: 'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074'
    }, {
        remediation_id: remediations[0].id,
        issue_id: 'vulnerabilities:CVE-2017-5715:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074'
    }], opts);

    await q.bulkInsert('remediation_issue_systems', [{
        system_id: systems[0],
        remediation_issue_id: issues[0].id,
        resolved: false
    }, {
        system_id: systems[0],
        remediation_issue_id: issues[1].id,
        resolved: true
    }, {
        system_id: systems[0],
        remediation_issue_id: issues[2].id,
        resolved: true
    }, {
        system_id: systems[0],
        remediation_issue_id: issues[3].id,
        resolved: false
    }, {
        system_id: systems[0],
        remediation_issue_id: issues[4].id,
        resolved: false
    }, {
        system_id: systems[1],
        remediation_issue_id: issues[0].id,
        resolved: false
    }, {
        remediation_issue_id: issues[5].id,
        system_id: systems[0],
        resolved: false
    }, {
        remediation_issue_id: issues[6].id,
        system_id: systems[0],
        resolved: false
    }, {
        remediation_issue_id: issues[7].id,
        system_id: systems[0],
        resolved: true
    }, {
        remediation_issue_id: issues[7].id,
        system_id: systems[1],
        resolved: true
    }, {
        remediation_issue_id: issues[8].id,
        system_id: systems[0],
        resolved: false
    }, {
        remediation_issue_id: issues[9].id,
        system_id: systems[0],
        resolved: false
    }]);
};

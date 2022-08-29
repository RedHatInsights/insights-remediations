'use strict';

const { account_number, tenant_org_id, username: created_by } = require('../../src/connectors/users/mock').MOCK_USERS.testReadSingleUser;

const { NON_EXISTENT_SYSTEM } = require('../../src/connectors/inventory/mock');
const SYSTEM = '1040856f-b772-44c7-83a9-eea4813c4be8';
const SYSTEM2 = '9dae9304-86a8-4f66-baa3-a1b27dfdd479';
const SYSTEM3 = '4bb19a8a-0c07-4ee6-a78c-504dab783cc8';

const opts = {
    returning: true
};

/* eslint-disable security/detect-object-injection */
exports.up = async q => {
    const remediations = await q.bulkInsert('remediations', [{
        id: '82aeb63f-fc25-4eef-9333-4fa7e10f7217',
        name: 'missing system 1',
        auto_reboot: true,
        account_number,
        tenant_org_id,
        created_by,
        created_at: '2018-11-04T08:19:36.641Z',
        updated_by: created_by,
        updated_at: '2018-11-04T08:19:36.641Z'
    }, {
        id: '27e36e14-e1c2-4b5a-9382-ec80ca9a6c1a',
        name: 'missing system 2',
        auto_reboot: true,
        account_number,
        tenant_org_id,
        created_by,
        created_at: '2018-11-04T07:19:36.641Z',
        updated_by: created_by,
        updated_at: '2018-11-04T07:19:36.641Z'
    }, {
        id: 'ea5b1507-4cd3-4c87-aa5a-6c755d32a7bd',
        name: 'unknown resolution',
        auto_reboot: true,
        account_number,
        tenant_org_id,
        created_by,
        created_at: '2018-11-04T06:19:36.641Z',
        updated_by: created_by,
        updated_at: '2018-11-04T06:19:36.641Z'
    }, {
        id: '62c95092-ac83-4025-a676-362a67e68579',
        name: 'unknown issues',
        auto_reboot: true,
        account_number,
        tenant_org_id,
        created_by,
        created_at: '2018-11-04T05:19:36.641Z',
        updated_by: created_by,
        updated_at: '2018-11-04T05:19:36.641Z'
    }, {
        id: 'c3f9f751-4bcc-4222-9b83-77f5e6e603da',
        name: 'many systems',
        auto_reboot: true,
        account_number,
        tenant_org_id,
        created_by,
        created_at: '2018-11-04T04:19:36.641Z',
        updated_by: created_by,
        updated_at: '2018-11-04T04:19:36.641Z'
    }, {
        id: 'd1b070b5-1db8-4dac-8ecf-891dc1e9225f',
        name: 'no systems',
        auto_reboot: true,
        account_number,
        tenant_org_id,
        created_by,
        created_at: '2018-11-04T03:19:36.641Z',
        updated_by: created_by,
        updated_at: '2018-11-04T03:19:36.641Z'
    }, {
        id: '5e6d136e-ea32-46e4-a350-325ef41790f4',
        name: 'test namespace',
        auto_reboot: false,
        account_number,
        tenant_org_id,
        created_by,
        created_at: '2018-11-04T03:19:36.641Z',
        updated_by: created_by,
        updated_at: '2018-11-04T03:19:36.641Z'
    }, {
        id: '7d727f9c-7d9e-458d-a128-a9ffae1802ab',
        name: 'system profile test',
        auto_reboot: false,
        account_number,
        tenant_org_id,
        created_by,
        created_at: '2018-11-04T03:19:36.641Z',
        updated_by: created_by,
        updated_at: '2018-11-04T03:19:36.641Z'
    }], opts);

    const issues = await q.bulkInsert('remediation_issues', [{
        remediation_id: remediations[0].id,
        issue_id: 'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074'
    }, {
        remediation_id: remediations[1].id,
        issue_id: 'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074'
    }, {
        remediation_id: remediations[1].id,
        issue_id: 'vulnerabilities:CVE-2017-5715'
    }, {
        remediation_id: remediations[2].id,
        issue_id: 'vulnerabilities:CVE-2017-5715',
        resolution: 'non-existent-resolution'
    }, {
        remediation_id: remediations[3].id,
        issue_id: 'advisor:non-existent-issue'
    }, {
        remediation_id: remediations[3].id,
        issue_id: 'vulnerabilities:CVE-2000-17713'
    }, {
        remediation_id: remediations[3].id,
        issue_id: 'advisor:non-existent-issue2'
    }, {
        remediation_id: remediations[3].id,
        issue_id: 'ssg:rhel7|pci-dss|xccdf_org.ssgproject.content_rule_non-existent-issue'
    }, {
        remediation_id: remediations[4].id,
        issue_id: 'vulnerabilities:CVE-2017-5715'
    }, {
        remediation_id: remediations[5].id,
        issue_id: 'vulnerabilities:CVE-2019-6133'
    }, {
        remediation_id: remediations[5].id,
        issue_id: 'vulnerabilities:CVE-2019-3863'
    }, {
        remediation_id: remediations[5].id,
        issue_id: 'vulnerabilities:CVE-2019-3857'
    }, {
        remediation_id: remediations[6].id,
        issue_id: 'test:ping'
    }, {
        remediation_id: remediations[6].id,
        issue_id: 'test:reboot'
    }, {
        remediation_id: remediations[7].id,
        issue_id: 'test:reboot'
    }], opts);

    await q.bulkInsert('remediation_issue_systems', [
        ...[0, 1, 3, 4, 5, 6, 7, 12, 13].map(i => ({
            remediation_issue_id: issues[i].id,
            system_id: SYSTEM,
            resolved: false
        })),
        ...[0, 2].map(i => ({
            remediation_issue_id: issues[i].id,
            system_id: NON_EXISTENT_SYSTEM,
            resolved: false
        })),
        ...Array(250).fill(0).map((value, key) => ({
            remediation_issue_id: issues[8].id,
            system_id: `84762eb3-0bbb-4bd8-ab11-f420c50e9${String(key).padStart(3, '0')}`,
            resolved: false
        })),
        {
            remediation_issue_id: issues[12].id,
            system_id: SYSTEM2,
            resolved: false
        },
        {
            remediation_issue_id: issues[14].id,
            system_id: SYSTEM3,
            resolved: false
        }
    ]);
};

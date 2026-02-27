'use strict';

const _ = require('lodash');
const { account_number, tenant_org_id, username: created_by } = require('../../src/connectors/users/mock').MOCK_USERS.fifi;

const opts = {
    returning: true
};

const systems = [
    // connected
    'b84f4322-a0b8-4fb9-a8dc-8abb9ee16bc0',
    '355986a3-5f37-40f7-8f36-c3ac928ce190',
    'd5174274-4307-4fac-84fd-da2c3497657c',

    // disconnected
    'a9b3af62-8404-4b2a-9084-9ed37da6baf1',
    '36828b63-38f3-4b9a-ad08-0b7812e5df57',
    'baaad5ad-1b8e-457e-ad43-39d1aea40d4d',
    'e4a0a6ff-0f01-4659-ad9d-44150ade51dd',
    '88d0ba73-0015-4e7d-a6d6-4b530cbfb4ad',
    '8728dbf3-6500-44bb-a55c-4909a48673ed',

    // no_receptor
    'bd91d212-91ae-4813-a406-d2af96fbeb52',
    '881256d7-8f99-4073-be6d-67ee42ba9af8',
    '64ee45db-6f2b-4862-bc9a-40aea8f5ecbe',
    '34360dba-a2e7-4788-b9a2-44246a865c7e',
    '3fec343b-ecc0-4049-9e30-e4dc2bae9f62',

    // no_source
    '95c5ee0d-9599-475f-a8ef-c838545b9a73',
    '6f6a889d-6bac-4d53-9bc1-ef75bc1a55ff',
    '938c5ce7-481f-4b82-815c-2973ca76a0ef',
    '2a708189-4b48-4642-9443-64bda5f38e5f',

    // no_executor
    '9574cba7-b9ce-4725-b392-e959afd3e69a',
    '750c60ee-b67e-4ccd-8d7f-cb8aed2bdbf4',
    '0341e468-fbae-416c-b16f-5abb64d99834',

    // connected
    // these two systems have the same ansible_host - only one of them should show up
    '35e9b452-e405-499c-9c6e-120010b7b465',
    '35f36364-6007-4ecc-9666-c4f8d354be9f'
];

exports.up = async q => {
    const remediations = await q.bulkInsert('remediations', [{
        id: '0ecb5db7-2f1a-441b-8220-e5ce45066f50',
        name: 'FiFI playbook',
        auto_reboot: true,
        account_number,
        tenant_org_id,
        created_by,
        created_at: '2019-12-23T08:19:36.641Z',
        updated_by: created_by,
        updated_at: '2019-12-23T08:19:36.641Z'
    }, {
        id: '249f142c-2ae3-4c3f-b2ec-c8c5881f6927',
        name: 'FiFI playbook 2',
        auto_reboot: true,
        account_number,
        tenant_org_id,
        created_by,
        created_at: '2019-12-23T18:19:36.641Z',
        updated_by: created_by,
        updated_at: '2019-12-23T18:19:36.641Z'
    }, {
        id: '249f142c-2ae3-4c3f-b2ec-c8c5881f8561',
        name: 'FiFI playbook 3',
        auto_reboot: true,
        account_number,
        tenant_org_id,
        created_by,
        created_at: '2020-01-23T18:19:36.641Z',
        updated_by: created_by,
        updated_at: '2020-01-23T18:19:36.641Z'
    }, {
        id: 'd12efef0-9580-4c82-b604-9888e2269c5a',
        name: 'FiFI playbook 4',
        auto_reboot: true,
        account_number,
        tenant_org_id,
        created_by,
        created_at: '2020-01-23T18:19:36.641Z',
        updated_by: created_by,
        updated_at: '2020-01-23T18:19:36.641Z'
    }, {
        id: '63d92aeb-9351-4216-8d7c-044d171337bc',
        name: 'FiFI playbook 5',
        auto_reboot: true,
        account_number,
        tenant_org_id,
        created_by,
        created_at: '2020-01-23T18:19:36.641Z',
        updated_by: created_by,
        updated_at: '2020-01-23T18:19:36.641Z'
    }, {
        id: '64d92aeb-9351-4216-8d7c-044d171337bd',
        name: 'FiFI playbook 6',
        auto_reboot: true,
        account_number,
        tenant_org_id,
        created_by,
        created_at: '2020-01-23T18:19:36.641Z',
        updated_by: created_by,
        updated_at: '2020-01-23T18:19:36.641Z'
    }], opts);

    const issues = await q.bulkInsert('remediation_issues', [{
        remediation_id: remediations[0].id,
        issue_id: 'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE'
    }, {
        remediation_id: remediations[0].id,
        issue_id: 'vulnerabilities:CVE-2017-17712'
    }, {
        remediation_id: remediations[0].id,
        issue_id: 'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_service_autofs_disabled'
    }, {
        remediation_id: remediations[2].id,
        issue_id: 'test:ping'
    }, {
        remediation_id: remediations[3].id,
        issue_id: 'test:ping'
    }, {
        remediation_id: remediations[4].id,
        issue_id: 'test:ping'
    }, {
        remediation_id: remediations[5].id,
        issue_id: 'test:ping'
    }], opts);

    await q.bulkInsert('remediation_issue_systems', _.flatMap(systems, system_id => issues.map(({ id }) => ({
        system_id,
        remediation_issue_id: id,
        resolved: false
    }))));

    // vulnerabilities resolution_type test
    const vuln_remediation_id = await q.bulkInsert('remediations', [{
        id: '0e1c1018-cb54-4459-945b-f5d946645b7a',
        name: 'Vulnerabilities playbook',
        auto_reboot: true,
        account_number,
        tenant_org_id,
        created_by,
        created_at: '2023-12-23T08:19:36.641Z',
        updated_by: created_by,
        updated_at: '2022-12-23T08:19:36.641Z'
    }], opts);

    const vuln_issue_id = await q.bulkInsert('remediation_issues', [{
        remediation_id: vuln_remediation_id[0].id,
        issue_id: 'vulnerabilities:CVE_2021_4034_polkit|CVE_2021_4034_POLKIT',
        resolution: 'update'
    }], opts);

    await q.bulkInsert('remediation_issue_systems', [{
        system_id: '2317adf3-911e-4db3-84fd-27fad9724196',
        remediation_issue_id: vuln_issue_id[0].id,
        resolved: false
    }, {
        system_id: '286f602a-157f-4095-8bf2-ad4849ab6c43',
        remediation_issue_id: vuln_issue_id[0].id,
        resolved: false
    }]);

    await q.bulkInsert('playbook_runs', [{
        id: '88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc',
        status: 'running',
        remediation_id: remediations[2].id,
        created_by,
        created_at: '2019-12-23T08:19:36.641Z',
        updated_at: '2019-12-23T08:19:36.641Z'
    }, {
        id: '88d0ba73-0015-4e7d-a6d6-4b530cbfb6bc',
        status: 'running',
        remediation_id: remediations[3].id,
        created_by,
        created_at: '2019-12-23T08:19:36.641Z',
        updated_at: '2019-12-23T08:19:36.641Z'
    }, {
        id: '99d0ba73-0015-4e7d-a6d6-4b530cbfb6de',
        status: 'running',
        remediation_id: remediations[4].id,
        created_by,
        created_at: '2019-12-23T08:19:36.641Z',
        updated_at: '2019-12-23T08:19:36.641Z'
    }, {
        id: '55d0ba73-0015-4e7d-a6d6-4b530cbfb6de',
        status: 'running',
        remediation_id: remediations[4].id,
        created_by,
        created_at: '2019-12-23T08:19:36.641Z',
        updated_at: '2019-12-23T08:19:36.641Z'
    }, {
        id: '88d0ba73-0015-4e7d-a6d6-4b530cbfb7bc',
        status: 'running',
        remediation_id: remediations[3].id,
        created_by,
        created_at: '2019-12-23T08:19:36.641Z',
        updated_at: '2019-12-23T08:19:36.641Z'
    }, {
        id: '31a70e85-378a-4436-96e9-677cd6fba660',
        status: 'pending',
        remediation_id: remediations[2].id,
        created_by,
        created_at: '2020-02-23T06:19:36.641Z',
        updated_at: '2020-02-23T06:19:36.641Z'
    }, {
        id: '7d462faa-0918-44e2-9b36-dbdbb69db463',
        status: 'success',
        remediation_id: remediations[5].id,
        created_by,
        created_at: '2020-02-23T06:19:36.641Z',
        updated_at: '2020-02-23T06:19:36.641Z'
    }], opts);
};

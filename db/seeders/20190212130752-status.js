'use strict';

const _ = require('lodash');
const { account_number, tenant_org_id, username: created_by } = require('../../src/connectors/users/mock').MOCK_USERS.testStatus;

const opts = {
    returning: true
};

const systems = [
    '9ed58c88-a98d-407f-9384-a76bdab82e7f',
    '20a7486c-11bc-4558-a398-f97faf47cdbb',
    '2317adf3-911e-4db3-84fd-27fad9724196',
    '286f602a-157f-4095-8bf2-ad4849ab6c43'
];

const status_aggregation_systems = [
    'c8aea8e7-cce7-4d2c-b45c-97408158fa44', // running
    'bd0f6a65-d43a-4d45-88da-ede32b9787e5', // success
    'c5249a49-8ed1-4c3c-acd9-f540806829fd', // failure
    '41202783-c2dc-4bc3-b93c-1bace78b9d3a', // timeout
    '1a87d019-e0b4-4ed2-9364-10cc9824e755', // canceled
    'c751a80e-0fa8-4967-9c2a-fae9da4411fa', // timeout
    'f1f6dbe3-249c-490b-922f-120689059927', // success
    '720e5c42-d57e-4e51-8177-7fcd1e70415b', // running
    '39735eef-5e47-42d5-bbde-46d8d75cadfd', // canceled
    '4ee9151c-ec74-49c4-80d4-c9d99b69e6b0'  // failure
];

exports.up = async q => {
    const remediations = await q.bulkInsert('remediations', [
        {
            id: 'bf0af437-2842-44d4-90de-bd83d40f7ea6',
            name: 'playbook',
            auto_reboot: true,
            account_number,
            tenant_org_id,
            created_by,
            created_at: '2018-11-04T08:19:36.641Z',
            updated_by: created_by,
            updated_at: '2018-11-04T08:19:36.641Z'
        },
        {
            id: 'efe9fd2b-fdbd-4c74-93e7-8c69f1b668f3',
            name: 'status aggregation test',
            auto_reboot: true,
            account_number,
            tenant_org_id,
            created_by,
            created_at: '2024-09-10T11:41:12.221Z',
            updated_by: created_by,
            updated_at: '2024-09-10T11:41:12.221Z'
        }
    ], opts);

    const issues = await q.bulkInsert('remediation_issues', [{
        remediation_id: remediations[0].id,
        issue_id: 'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE'
    }, {
        remediation_id: remediations[0].id,
        issue_id: 'vulnerabilities:CVE-2017-17712'
    }, {
        remediation_id: remediations[0].id,
        issue_id: 'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_service_autofs_disabled'
    }], opts);

    await q.bulkInsert('remediation_issue_systems', _.flatMap(systems, system_id => issues.map(({ id }) => ({
        system_id,
        remediation_issue_id: id,
        resolved: false
    }))));

    // create entries for RHC-direct status aggregation test
    const status_aggregation_issue = await q.bulkInsert('remediation_issues', [{
        remediation_id: remediations[1].id,
        issue_id: 'ssg:rhel9|cis_server_l1|xccdf_org.ssgproject.content_rule_sysctl_net_ipv6_conf_default_accept_ra'
    }], opts);

    await q.bulkInsert(
        'remediation_issue_systems',
        _.flatMap(status_aggregation_systems, system_id => status_aggregation_issue.map(({ id }) => ({
            system_id,
            remediation_issue_id: id,
            resolved: false
        })))
    );

    await q.bulkInsert('playbook_runs', [{
        id: '8ff5717a-cce8-4738-907b-a89eaa559275',
        status: 'running',
        remediation_id: remediations[1].id,
        created_by,
        created_at: '2024-09-10T22:00:00.000Z',
        updated_at: '2024-09-10T22:00:00.000Z'
    }], opts);
};
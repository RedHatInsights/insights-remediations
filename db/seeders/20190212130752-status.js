'use strict';

const _ = require('lodash');
const { account_number, username: created_by } = require('../../src/connectors/users/mock').MOCK_USERS.testStatus;

const opts = {
    returning: true
};

const systems = [
    '9ed58c88-a98d-407f-9384-a76bdab82e7f',
    '20a7486c-11bc-4558-a398-f97faf47cdbb',
    '2317adf3-911e-4db3-84fd-27fad9724196',
    '286f602a-157f-4095-8bf2-ad4849ab6c43'
];

exports.up = async q => {
    const remediations = await q.bulkInsert('remediations', [{
        id: 'bf0af437-2842-44d4-90de-bd83d40f7ea6',
        name: 'playbook',
        auto_reboot: true,
        account_number,
        created_by,
        created_at: '2018-11-04T08:19:36.641Z',
        updated_by: created_by,
        updated_at: '2018-11-04T08:19:36.641Z'
    }], opts);

    const issues = await q.bulkInsert('remediation_issues', [{
        remediation_id: remediations[0].id,
        issue_id: 'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE'
    }, {
        remediation_id: remediations[0].id,
        issue_id: 'vulnerabilities:CVE-2017-17712'
    }, {
        remediation_id: remediations[0].id,
        issue_id: 'compliance:xccdf_org.ssgproject.content_rule_sshd_disable_root_login'
    }], opts);

    await q.bulkInsert('remediation_issue_systems', _.flatMap(systems, system_id => issues.map(({ id }) => ({
        system_id,
        remediation_issue_id: id
    }))));
};

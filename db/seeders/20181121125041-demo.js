'use strict';

const tenant = 'demo';
const owner = 1;

const opts = {
    returning: true
};

const systems = [
    '8dadd8d7-5f1d-49c3-a560-af3cada7ce83',
    'fc84c991-a029-4882-bc9c-7e351a73b59f',
    '58b2837a-5df5-4466-9033-c4b46248d4b4',
    '29dafba0-c190-4acd-998d-074ba0aee477'
];

exports.up = async q => {
    const remediations = await q.bulkInsert('remediations', [{
        id: '9939e04a-a936-482d-a317-008c058f7918',
        name: 'Patch vulnerabilities on production systems',
        tenant,
        owner,
        created_at: '2018-11-21T10:19:38.541Z',
        updated_at: '2018-11-21T10:19:38.541Z'
    }, {
        id: '0bcebc81-0d53-4f77-b0f0-1a56e01a55fd',
        name: 'Recommended configuration changes',
        tenant,
        owner,
        created_at: '2018-11-21T09:19:38.541Z',
        updated_at: '2018-11-21T09:19:38.541Z'
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
        remediation_id: remediations[1].id,
        issue_id: 'advisor:bond_config_issue|BOND_CONFIG_ISSUE'
    }, {
        remediation_id: remediations[1].id,
        issue_id: 'compliance:sshd_disable_root_login'
    }], opts);

    issues.forEach(issue => {
        const systemSlice = (issue.remediation_id === remediations[0].id) ? systems.slice(0, 2) : systems.slice(2);

        q.bulkInsert('remediation_issue_systems', systemSlice.map(system => ({
            remediation_issue_id: issue.id,
            system_id: system
        })));
    });
};

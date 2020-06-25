'use strict';

const _ = require('lodash');

const { account_number, username: created_by } = require('../../src/connectors/users/mock').MOCK_USERS.demoUser;

const opts = {
    returning: true
};

const systems = [
    '8dadd8d7-5f1d-49c3-a560-af3cada7ce83',
    'fc84c991-a029-4882-bc9c-7e351a73b59f',
    '58b2837a-5df5-4466-9033-c4b46248d4b4',
    '29dafba0-c190-4acd-998d-074ba0aee477',
    '784ba855-922c-4dbf-bb93-d2e5d9e54a81',
    '4f02195c-a3e4-4dcf-aeca-65db4ca25632',
    '5afdc03f-4560-4ca9-a373-9724401df154',
    '8fa9e16e-eed5-4597-8072-b102b7c35f11',
    '9da41b6e-f77e-430a-9022-4ac1ffab288a'
];

const cves = [
    'CVE-2015-9262',
    'CVE-2016-9396',
    'CVE-2017-1000050',
    'CVE-2017-10268',
    'CVE-2017-10378',
    'CVE-2017-10379',
    'CVE-2017-10384',
    'CVE-2017-18267',
    'CVE-2017-3636',
    'CVE-2017-3641',
    'CVE-2017-3651',
    'CVE-2017-3653',
    'CVE-2017-3735',
    'CVE-2018-0494',
    'CVE-2018-0495',
    'CVE-2018-0732',
    'CVE-2018-0737',
    'CVE-2018-0739',
    'CVE-2018-1000007',
    'CVE-2018-1000120',
    'CVE-2018-1000121',
    'CVE-2018-1000122',
    'CVE-2018-1000156',
    'CVE-2018-1000301',
    'CVE-2018-10372',
    'CVE-2018-10373',
    'CVE-2018-10534',
    'CVE-2018-10535',
    'CVE-2018-10733',
    'CVE-2018-10767',
    'CVE-2018-10768',
    'CVE-2018-10844',
    'CVE-2018-10845',
    'CVE-2018-10846',
    'CVE-2018-10897',
    'CVE-2018-1113',
    'CVE-2018-11235',
    'CVE-2018-1124',
    'CVE-2018-1126',
    'CVE-2018-12020',
    'CVE-2018-12384',
    'CVE-2018-12910',
    'CVE-2018-13033',
    'CVE-2018-13988',
    'CVE-2018-14526',
    'CVE-2018-17456',
    'CVE-2018-18311',
    'CVE-2018-2562',
    'CVE-2018-2622',
    'CVE-2018-2640',
    'CVE-2018-2665',
    'CVE-2018-2668',
    'CVE-2018-2755',
    'CVE-2018-2761',
    'CVE-2018-2767',
    'CVE-2018-2771',
    'CVE-2018-2781',
    'CVE-2018-2813',
    'CVE-2018-2817',
    'CVE-2018-2819',
    'CVE-2018-3133',
    'CVE-2018-5407',
    'CVE-2018-5729',
    'CVE-2018-5730',
    'CVE-2018-5740',
    'CVE-2018-5742',
    'CVE-2018-7208',
    'CVE-2018-7568',
    'CVE-2018-7569',
    'CVE-2018-7642',
    'CVE-2018-7643',
    'CVE-2018-8945',
    'CVE-2019-3855',
    'CVE-2019-3856',
    'CVE-2019-3857',
    'CVE-2019-3863',
    'CVE-2019-6133'
];

exports.up = async q => {
    const remediations = await q.bulkInsert('remediations', [{
        id: '9939e04a-a936-482d-a317-008c058f7918',
        name: 'Patch vulnerabilities on production systems',
        account_number,
        created_by,
        created_at: '2018-11-21T10:19:38.541Z',
        updated_by: created_by,
        updated_at: '2018-11-21T10:19:38.541Z'
    }, {
        id: '0bcebc81-0d53-4f77-b0f0-1a56e01a55fd',
        name: 'Recommended configuration changes',
        account_number,
        created_by,
        created_at: '2018-11-21T09:19:38.541Z',
        updated_by: created_by,
        updated_at: '2018-11-21T09:19:38.541Z'
    }, {
        id: '42503118-80d4-49e0-bfee-20ac2d8ea74f',
        name: 'Mixed remediation',
        account_number,
        created_by,
        created_at: '2018-11-21T11:19:38.541Z',
        updated_by: created_by,
        updated_at: '2018-11-21T11:19:38.541Z'
    }, {
        id: '99999999-99d9-99e9-bfee-99ac9d9ea99f',
        name: 'Remediation with no issues',
        account_number,
        created_by,
        created_at: '2018-11-21T11:19:38.541Z',
        updated_by: created_by,
        updated_at: '2018-11-21T11:19:38.541Z'
    }, {
        id: '10b533ec-ff1c-4643-8f45-aa0f4a26987a',
        name: 'Vulnerability',
        account_number,
        created_by,
        created_at: '2018-11-21T13:19:38.541Z',
        updated_by: created_by,
        updated_at: '2018-11-21T13:19:38.541Z'
    }], opts);

    const issues = await q.bulkInsert('remediation_issues', [{
        remediation_id: remediations[0].id,
        issue_id: 'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074'
    }, {
        remediation_id: remediations[0].id,
        issue_id: 'vulnerabilities:CVE-2017-5715'
    }, {
        remediation_id: remediations[0].id,
        issue_id: 'vulnerabilities:CVE-2017-17712'
    }, {
        remediation_id: remediations[1].id,
        issue_id: 'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE'
    }, {
        remediation_id: remediations[1].id,
        issue_id: 'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_service_autofs_disabled'
    },
    ...cves.map(cve => ({
        remediation_id: remediations[4].id,
        issue_id: `vulnerabilities:${cve}`
    }))
    ], opts);

    issues.forEach(issue => {
        const systemSlice = (issue.remediation_id === remediations[0].id) ? systems.slice(0, 2) : systems.slice(2, 4);

        q.bulkInsert('remediation_issue_systems', systemSlice.map(system => ({
            remediation_issue_id: issue.id,
            system_id: system,
            resolved: false
        })));
    });

    const mixedIssues = await q.bulkInsert('remediation_issues', [{
        remediation_id: remediations[2].id,
        issue_id: 'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE'
    }, {
        remediation_id: remediations[2].id,
        issue_id: 'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074'
    }, {
        remediation_id: remediations[2].id,
        issue_id: 'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_service_autofs_disabled'
    }], opts);

    await q.bulkInsert('remediation_issue_systems', _.flatMap(mixedIssues, (issue, i) => {
        const index = i * 3;
        return systems.slice(index, index + 3).map(system => ({
            remediation_issue_id: issue.id,
            system_id: system,
            resolved: false
        }));
    }));
};

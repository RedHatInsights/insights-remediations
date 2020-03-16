'use strict';

require('../test');
const uuid = require('uuid/v4');
const fifi = require('./fifi');

const SYSTEMS = [
    {
        id: '355986a3-5f37-40f7-8f36-c3ac928ce190',
        ansible_host: null,
        hostname: '355986a3-5f37-40f7-8f36-c3ac928ce190.example.com',
        display_name: null
    },
    {
        id: 'b84f4322-a0b8-4fb9-a8dc-8abb9ee16bc0',
        ansible_host: null,
        hostname: 'b84f4322-a0b8-4fb9-a8dc-8abb9ee16bc0',
        display_name: null
    },
    {
        id: 'd5174274-4307-4fac-84fd-da2c3497657c',
        ansible_host: null,
        hostname: 'd5174274-4307-4fac-84fd-da2c3497657c',
        display_name: null
    }
];

const REMEDIATIONISSUES = [
    {
        issue_id: 'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_service_autofs_disabled',
        resolution: null,
        systems: [
            {system_id: uuid()}, {system_id: uuid()}, {system_id: SYSTEMS[0].id}
        ]
    },
    {
        issue_id: 'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_service_autofs_enabled',
        resolution: null,
        systems: [
            {system_id: uuid()}, {system_id: uuid()}, {system_id: uuid()}
        ]
    },
    {
        issue_id: 'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_service_autofs_connected',
        resolution: null,
        systems: [
            {system_id: SYSTEMS[0].id}, {system_id: SYSTEMS[1].id}, {system_id: uuid()}
        ]
    },
    {
        issue_id: 'ssg:rhel8|standard|xccdf_org.ssgproject.content_rules_service_autofs_not_found',
        resolution: null,
        systems: [
            {system_id: SYSTEMS[1].id}, {system_id: SYSTEMS[0].id}, {system_id: SYSTEMS[2].id}
        ]
    }
];

const SYSTEM_FACTS = [
    {
        namespace: 'receptor',
        facts: { satellite_instance_id: '01bf542e-6092-485c-ba04-c656d77f988a' }
    }
];

describe('connection status functions', function () {
    test('test if get system id return null if satellite namespace is missing', async () => {
        const result = fifi.getSatelliteId(SYSTEM_FACTS);

        expect(result).toBeNull();
    });
});

describe('playbook run functions', function () {
    test('test playbook slicing function', async () => {
        const parsedIssues = await fifi.filterIssuesPerExecutor(SYSTEMS, REMEDIATIONISSUES);

        parsedIssues.should.have.length(3);
        parsedIssues[0].issue_id.should.equal(REMEDIATIONISSUES[0].issue_id);
        parsedIssues[1].issue_id.should.equal(REMEDIATIONISSUES[2].issue_id);
        parsedIssues[2].issue_id.should.equal(REMEDIATIONISSUES[3].issue_id);

        parsedIssues[0].systems.should.have.length(1);
        parsedIssues[1].systems.should.have.length(2);
        parsedIssues[2].systems.should.have.length(3);

        parsedIssues[0].systems[0].system_id.should.equal(SYSTEMS[0].id);
        parsedIssues[1].systems[0].system_id.should.equal(SYSTEMS[0].id);
        parsedIssues[1].systems[1].system_id.should.equal(SYSTEMS[1].id);
        parsedIssues[2].systems[0].system_id.should.equal(SYSTEMS[1].id);
        parsedIssues[2].systems[1].system_id.should.equal(SYSTEMS[0].id);
        parsedIssues[2].systems[2].system_id.should.equal(SYSTEMS[2].id);
    });
});

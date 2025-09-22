'use strict';

const base = require('../test');
const {v4: uuid} = require('uuid');
const fifi = require('./fifi');
const fifi2 = require('./fifi_2');
const db = require('../db');
const dispatcher = require('../connectors/dispatcher');
const queries = require('./remediations.queries');

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

describe('syncDispatcherRunsForPlaybookRuns', function () {
    const mockPlaybookRunId1 = uuid();
    const mockPlaybookRunId2 = uuid();
    const mockPlaybookRunId3 = uuid();

    test('should return empty array when no playbook run IDs provided', async () => {
        const result = await fifi2.syncDispatcherRunsForPlaybookRuns([]);
        result.should.have.length(0);
    });

    test('should backfill when no dispatcher_runs exist', async () => {
        // Mock queries.getPlaybookRunsWithDispatcherCounts - no dispatcher_runs exist
        base.sandbox.stub(queries, 'getPlaybookRunsWithDispatcherCounts').resolves([
            {
                id: mockPlaybookRunId1,
                total_dispatcher_runs: 0,
                failed_runs: 0,
                incomplete_runs: 0
            }
        ]);

        // Mock API response
        const mockDispatcherResponse = {
            data: [
                { id: 'dispatcher-run-1', status: 'success' },
                { id: 'dispatcher-run-2', status: 'running' }
            ]
        };
        base.sandbox.stub(dispatcher, 'fetchPlaybookRuns').resolves(mockDispatcherResponse);
        
        // Mock insertDispatcherRuns
        base.sandbox.stub(queries, 'insertDispatcherRuns').resolves();

        const result = await fifi2.syncDispatcherRunsForPlaybookRuns([mockPlaybookRunId1]);

        // Should return the synced runs
        result.should.have.length(1);
        result[0].should.equal(mockPlaybookRunId1);

        // Should call API with correct filter
        dispatcher.fetchPlaybookRuns.calledOnceWith(
            { filter: { service: 'remediations', labels: { 'playbook-run': mockPlaybookRunId1 } } },
            { fields: { data: ['id', 'status'] } }
        ).should.equal(true);

        // Should insert new dispatcher_runs entries and check that it was called with correct data structure
        queries.insertDispatcherRuns.calledOnce.should.equal(true);
        const insertArgs = queries.insertDispatcherRuns.getCall(0).args[0];
        insertArgs.should.have.length(2);
        insertArgs[0].dispatcher_run_id.should.equal('dispatcher-run-1');
        insertArgs[0].remediations_run_id.should.equal(mockPlaybookRunId1);
        insertArgs[0].status.should.equal('success');
        insertArgs[1].dispatcher_run_id.should.equal('dispatcher-run-2');
        insertArgs[1].remediations_run_id.should.equal(mockPlaybookRunId1);
        insertArgs[1].status.should.equal('running');
    });

    test('should update status when incomplete runs exist and no failures', async () => {
        // Mock queries.getPlaybookRunsWithDispatcherCounts - has incomplete runs but no failures
        base.sandbox.stub(queries, 'getPlaybookRunsWithDispatcherCounts').resolves([
            {
                id: mockPlaybookRunId2,
                total_dispatcher_runs: 2,
                failed_runs: 0,
                incomplete_runs: 1
            }
        ]);

        // Mock API response with updated statuses
        const mockDispatcherResponse = {
            data: [
                { id: 'dispatcher-run-3', status: 'success' },
                { id: 'dispatcher-run-4', status: 'success' }
            ]
        };
        base.sandbox.stub(dispatcher, 'fetchPlaybookRuns').resolves(mockDispatcherResponse);
        
        // Mock updateDispatcherRuns
        base.sandbox.stub(queries, 'updateDispatcherRuns').resolves();

        const result = await fifi2.syncDispatcherRunsForPlaybookRuns([mockPlaybookRunId2]);

        // Should return the synced runs
        result.should.have.length(1);
        result[0].should.equal(mockPlaybookRunId2);

        // Should call API with correct filter
        dispatcher.fetchPlaybookRuns.calledOnceWith(
            { filter: { service: 'remediations', labels: { 'playbook-run': mockPlaybookRunId2 } } },
            { fields: { data: ['id', 'status'] } }
        ).should.equal(true);

        // Should update existing dispatcher_runs entries
        queries.updateDispatcherRuns.calledTwice.should.equal(true);
        
        // Verify first update call
        const firstCall = queries.updateDispatcherRuns.getCall(0);
        firstCall.args[0].should.equal('dispatcher-run-3'); // dispatcherRunId
        firstCall.args[1].should.equal(mockPlaybookRunId2); // remediationsRunId
        firstCall.args[2].status.should.equal('success'); // updates object
        
        // Verify second update call
        const secondCall = queries.updateDispatcherRuns.getCall(1);
        secondCall.args[0].should.equal('dispatcher-run-4');
        secondCall.args[1].should.equal(mockPlaybookRunId2);
        secondCall.args[2].status.should.equal('success');
    });

    test('should skip sync when failed runs exist', async () => {
        // Mock queries.getPlaybookRunsWithDispatcherCounts - has failed runs
        base.sandbox.stub(queries, 'getPlaybookRunsWithDispatcherCounts').resolves([
            {
                id: mockPlaybookRunId3,
                total_dispatcher_runs: 3,
                failed_runs: 1,
                incomplete_runs: 0
            }
        ]);

        const result = await fifi2.syncDispatcherRunsForPlaybookRuns([mockPlaybookRunId3]);

        // Should return empty array (no sync needed)
        result.should.have.length(0);
    });

    test('should handle API call failures gracefully', async () => {
        // Mock queries.getPlaybookRunsWithDispatcherCounts - needs backfill
        base.sandbox.stub(queries, 'getPlaybookRunsWithDispatcherCounts').resolves([
            {
                id: mockPlaybookRunId1,
                total_dispatcher_runs: 0,
                failed_runs: 0,
                incomplete_runs: 0
            }
        ]);

        // Mock API to throw error
        base.sandbox.stub(dispatcher, 'fetchPlaybookRuns').rejects(new Error('API Error'));

        const result = await fifi2.syncDispatcherRunsForPlaybookRuns([mockPlaybookRunId1]);

        // Should return empty array since sync failed
        result.should.have.length(0);
    });

    test('should return only successfully synced playbook runs in mixed scenarios', async () => {
        const mockPlaybookRunId4 = uuid();
        const mockPlaybookRunId5 = uuid();
        
        // Mock queries.getPlaybookRunsWithDispatcherCounts - both need backfill
        base.sandbox.stub(queries, 'getPlaybookRunsWithDispatcherCounts').resolves([
            {
                id: mockPlaybookRunId4,
                total_dispatcher_runs: 0,
                failed_runs: 0,
                incomplete_runs: 0
            },
            {
                id: mockPlaybookRunId5,
                total_dispatcher_runs: 0,
                failed_runs: 0,
                incomplete_runs: 0
            }
        ]);

        // Mock API to succeed for first run, fail for second
        const apiStub = base.sandbox.stub(dispatcher, 'fetchPlaybookRuns');
        apiStub.withArgs(
            { filter: { service: 'remediations', labels: { 'playbook-run': mockPlaybookRunId4 } } },
            { fields: { data: ['id', 'status'] } }
        ).resolves({
            data: [{ id: 'dispatcher-run-success', status: 'success' }]
        });
        apiStub.withArgs(
            { filter: { service: 'remediations', labels: { 'playbook-run': mockPlaybookRunId5 } } },
            { fields: { data: ['id', 'status'] } }
        ).rejects(new Error('API Error'));
        
        // Mock insertDispatcherRuns
        base.sandbox.stub(queries, 'insertDispatcherRuns').resolves();

        const result = await fifi2.syncDispatcherRunsForPlaybookRuns([mockPlaybookRunId4, mockPlaybookRunId5]);

        // Should return only the successfully synced run ID
        result.should.have.length(1);
        result[0].should.equal(mockPlaybookRunId4);
    });
});

describe('formatRunHosts and formatRHCHostDetails', function () {
    const system1Id = 'f6b7a1c2-3d4e-5f6a-7b8c-9d0e1f2a3b4c';
    const system2Id = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const system3Id = 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e';
    const playbookRunId = '88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc';

    let getPlanSystemsDetailsStub;

    beforeEach(() => {
        getPlanSystemsDetailsStub = base.sandbox.stub(queries, 'getPlanSystemsDetails');
    });

    describe('formatRunHosts', function () {
        test('should use display_name as system_name when available', async () => {
            // Mock system details with display_name available
            getPlanSystemsDetailsStub.resolves({
                [system1Id]: {
                    hostname: 'server1.example.com',
                    ansible_hostname: 'ansible1',
                    display_name: 'Production Server 1'
                },
                [system2Id]: {
                    hostname: 'server2.example.com', 
                    ansible_hostname: 'ansible2',
                    display_name: 'Production Server 2'
                }
            });

            const mockRhcRuns = {
                data: [{
                    id: 'run1',
                    updated_at: '2023-10-01T12:00:00.000Z'
                }]
            };

            // Mock dispatcher.fetchPlaybookRunHosts
            base.sandbox.stub(dispatcher, 'fetchPlaybookRunHosts').resolves({
                data: [
                    {
                        inventory_id: system1Id,
                        status: 'success'
                    },
                    {
                        inventory_id: system2Id,
                        status: 'running'
                    }
                ]
            });

            const result = await fifi.formatRunHosts(mockRhcRuns, playbookRunId);

            result.should.have.length(2);
            result[0].should.have.property('system_id', system1Id);
            result[0].should.have.property('system_name', 'Production Server 1'); // Uses display_name
            result[1].should.have.property('system_id', system2Id);
            result[1].should.have.property('system_name', 'Production Server 2'); // Uses display_name
        });

        test('should fallback to hostname when display_name is null', async () => {
            // Mock system details with display_name null, hostname available
            getPlanSystemsDetailsStub.resolves({
                [system1Id]: {
                    hostname: 'server1.example.com',
                    ansible_hostname: 'ansible1',
                    display_name: null
                }
            });

            const mockRhcRuns = {
                data: [{
                    id: 'run1',
                    updated_at: '2023-10-01T12:00:00.000Z'
                }]
            };

            // Mock dispatcher.fetchPlaybookRunHosts
            base.sandbox.stub(dispatcher, 'fetchPlaybookRunHosts').resolves({
                data: [{
                    inventory_id: system1Id,
                    status: 'success'
                }]
            });

            const result = await fifi.formatRunHosts(mockRhcRuns, playbookRunId);

            result.should.have.length(1);
            result[0].should.have.property('system_id', system1Id);
            result[0].should.have.property('system_name', 'server1.example.com'); // Uses hostname fallback
        });

        test('should fallback to dispatcher host when system details not found', async () => {
            // Mock system details returning empty (system not found)
            getPlanSystemsDetailsStub.resolves({});

            const mockRhcRuns = {
                data: [{
                    id: 'run1',
                    updated_at: '2023-10-01T12:00:00.000Z'
                }]
            };

            // Mock dispatcher.fetchPlaybookRunHosts
            base.sandbox.stub(dispatcher, 'fetchPlaybookRunHosts').resolves({
                data: [{
                    inventory_id: system3Id,
                    status: 'success',
                    host: 'dispatcher-host-name'
                }]
            });

            const result = await fifi.formatRunHosts(mockRhcRuns, playbookRunId);

            result.should.have.length(1);
            result[0].should.have.property('system_id', system3Id);
            result[0].should.have.property('system_name', 'dispatcher-host-name'); // Uses dispatcher fallback
        });
    });

    describe('formatRHCHostDetails', function () {
        test('should use display_name as system_name when available', async () => {
            // Mock system details with display_name available
            getPlanSystemsDetailsStub.resolves({
                [system1Id]: {
                    hostname: 'server1.example.com',
                    ansible_hostname: 'ansible1', 
                    display_name: 'Production Server 1'
                }
            });

            const mockHost = {
                status: 'success',
                updated_at: '2023-10-01T12:00:00.000Z'
            };

            const mockDetails = {
                data: [{
                    inventory_id: system1Id,
                    host: 'dispatcher-host-name',
                    stdout: 'Console output here'
                }]
            };

            const result = await fifi.formatRHCHostDetails(mockHost, mockDetails, playbookRunId);

            result.should.have.property('system_id', system1Id);
            result.should.have.property('system_name', 'Production Server 1'); // Uses display_name
            result.should.have.property('status', 'success');
            result.should.have.property('console', 'Console output here');
        });

        test('should fallback to hostname when display_name is null', async () => {
            // Mock system details with display_name null, hostname available
            getPlanSystemsDetailsStub.resolves({
                [system1Id]: {
                    hostname: 'server1.example.com',
                    ansible_hostname: 'ansible1',
                    display_name: null
                }
            });

            const mockHost = {
                status: 'running',
                updated_at: '2023-10-01T12:00:00.000Z'
            };

            const mockDetails = {
                data: [{
                    inventory_id: system1Id,
                    host: 'dispatcher-host-name',
                    stdout: 'Console output here'
                }]
            };

            const result = await fifi.formatRHCHostDetails(mockHost, mockDetails, playbookRunId);

            result.should.have.property('system_id', system1Id);
            result.should.have.property('system_name', 'server1.example.com'); // Uses hostname fallback
            result.should.have.property('status', 'running');
        });

        test('should fallback to dispatcher host when system details not found', async () => {
            // Mock system details returning empty (system not found)
            getPlanSystemsDetailsStub.resolves({});

            const mockHost = {
                status: 'failure', 
                updated_at: '2023-10-01T12:00:00.000Z'
            };

            const mockDetails = {
                data: [{
                    inventory_id: system3Id,
                    host: 'dispatcher-host-name',
                    stdout: 'Console output here'
                }]
            };

            const result = await fifi.formatRHCHostDetails(mockHost, mockDetails, playbookRunId);

            result.should.have.property('system_id', system3Id);
            result.should.have.property('system_name', 'dispatcher-host-name'); // Uses dispatcher fallback
            result.should.have.property('status', 'failure');
        });

        test('should handle timeout status mapping correctly', async () => {
            // Mock system details with display_name available
            getPlanSystemsDetailsStub.resolves({
                [system1Id]: {
                    hostname: 'server1.example.com',
                    ansible_hostname: 'ansible1',
                    display_name: 'Production Server 1'
                }
            });

            const mockHost = {
                status: 'timeout', // Should be mapped to 'failure'
                updated_at: '2023-10-01T12:00:00.000Z'
            };

            const mockDetails = {
                data: [{
                    inventory_id: system1Id,
                    host: 'dispatcher-host-name',
                    stdout: 'Console output here'
                }]
            };

            const result = await fifi.formatRHCHostDetails(mockHost, mockDetails, playbookRunId);

            result.should.have.property('system_id', system1Id);
            result.should.have.property('system_name', 'Production Server 1'); // Uses display_name
            result.should.have.property('status', 'failure'); // timeout mapped to failure
        });
    });
});

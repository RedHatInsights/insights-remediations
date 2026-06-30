'use strict';

const base = require('../test');
const config = require('../config');
const queries = require('./remediations.queries');
const db = require('../db');
const inventory = require('../connectors/inventory');

describe('getPlanSystemsDetails', function () {
    const system1Id = 'f6b7a1c2-3d4e-5f6a-7b8c-9d0e1f2a3b4c';
    const system2Id = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const system3Id = 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e';
    const system4Id = 'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f';
    const missingSystemId = '00000000-0000-0000-0000-000000000000';

    let dbSystemsFindAllStub;
    let dbSystemsBulkCreateStub;
    let inventoryGetSystemDetailsBatchStub;

    beforeEach(() => {
        dbSystemsFindAllStub = base.sandbox.stub(db.systems, 'findAll');
        dbSystemsBulkCreateStub = base.sandbox.stub(db.systems, 'bulkCreate');
        inventoryGetSystemDetailsBatchStub = base.sandbox.stub(inventory, 'getSystemDetailsBatch');
    });

    test('should return empty object for empty input', async () => {
        const result = await queries.getPlanSystemsDetails([]);
        result.should.deepEqual({});

        // No database calls should be made
        dbSystemsFindAllStub.should.not.have.been.called;
        inventoryGetSystemDetailsBatchStub.should.not.have.been.called;
    });

    test('should return empty object for null input', async () => {
        const result = await queries.getPlanSystemsDetails(null);
        result.should.deepEqual({});

        // No database calls should be made
        dbSystemsFindAllStub.should.not.have.been.called;
        inventoryGetSystemDetailsBatchStub.should.not.have.been.called;
    });

    test('should fetch system details from database when all systems exist', async () => {
        const inventoryIds = [system1Id, system2Id];

        dbSystemsFindAllStub.onFirstCall().resolves([
            { id: system1Id },
            { id: system2Id }
        ]);

        dbSystemsFindAllStub.onSecondCall().resolves([
            {
                id: system1Id,
                hostname: 'server1.example.com',
                ansible_hostname: 'ansible1',
                display_name: 'Server 1'
            },
            {
                id: system2Id,
                hostname: 'server2.example.com',
                ansible_hostname: 'ansible2',
                display_name: 'Server 2'
            }
        ]);

        const result = await queries.getPlanSystemsDetails(inventoryIds);

        result.should.deepEqual({
            [system1Id]: {
                id: system1Id,
                hostname: 'server1.example.com',
                ansible_hostname: 'ansible1',
                display_name: 'Server 1'
            },
            [system2Id]: {
                id: system2Id,
                hostname: 'server2.example.com',
                ansible_hostname: 'ansible2',
                display_name: 'Server 2'
            }
        });

        dbSystemsFindAllStub.should.have.been.calledTwice;
        inventoryGetSystemDetailsBatchStub.should.not.have.been.called;
        dbSystemsBulkCreateStub.should.not.have.been.called;
    });

    test('should fetch missing systems from inventory service', async () => {
        const inventoryIds = [system1Id, missingSystemId];

        dbSystemsFindAllStub.onFirstCall().resolves([
            { id: system1Id }
        ]);

        inventoryGetSystemDetailsBatchStub.resolves({
            [missingSystemId]: {
                id: missingSystemId,
                hostname: 'missing-server.example.com',
                display_name: 'Missing Server',
                ansible_host: 'missing-ansible'
            }
        });

        dbSystemsFindAllStub.onSecondCall().resolves([
            {
                id: system1Id,
                hostname: 'server1.example.com',
                ansible_hostname: 'ansible1',
                display_name: 'Server 1'
            },
            {
                id: missingSystemId,
                hostname: 'missing-server.example.com',
                ansible_hostname: 'missing-ansible',
                display_name: 'Missing Server'
            }
        ]);

        const result = await queries.getPlanSystemsDetails(inventoryIds);

        result.should.deepEqual({
            [system1Id]: {
                id: system1Id,
                hostname: 'server1.example.com',
                ansible_hostname: 'ansible1',
                display_name: 'Server 1'
            },
            [missingSystemId]: {
                id: missingSystemId,
                hostname: 'missing-server.example.com',
                ansible_hostname: 'missing-ansible',
                display_name: 'Missing Server'
            }
        });

        // Should call inventory service for missing system
        inventoryGetSystemDetailsBatchStub.calledOnceWith([missingSystemId], false, 2, false).should.equal(true);
        dbSystemsFindAllStub.should.have.been.calledTwice;

        // Should store missing system in database
        dbSystemsBulkCreateStub.calledOnceWith([{
            id: missingSystemId,
            hostname: 'missing-server.example.com',
            display_name: 'Missing Server',
            ansible_hostname: 'missing-ansible'
        }], {
            ignoreDuplicates: true
        }).should.equal(true);
    });

    test('should omit systems not found anywhere', async () => {
        const inventoryIds = [system1Id, missingSystemId];

        dbSystemsFindAllStub.onFirstCall().resolves([
            { id: system1Id }
        ]);

        inventoryGetSystemDetailsBatchStub.resolves({});

        dbSystemsFindAllStub.onSecondCall().resolves([
            {
                id: system1Id,
                hostname: 'server1.example.com',
                ansible_hostname: 'ansible1',
                display_name: 'Server 1'
            }
        ]);

        const result = await queries.getPlanSystemsDetails(inventoryIds);

        result.should.deepEqual({
            [system1Id]: {
                id: system1Id,
                hostname: 'server1.example.com',
                ansible_hostname: 'ansible1',
                display_name: 'Server 1'
            }
        });

        result.should.not.have.property(missingSystemId);

        // Should try inventory service but system wasn't found
        inventoryGetSystemDetailsBatchStub.calledOnceWith([missingSystemId], false, 2, false).should.equal(true);
        dbSystemsFindAllStub.should.have.been.calledTwice;

        // Should not bulk create since no systems returned from inventory
        dbSystemsBulkCreateStub.called.should.equal(false);
    });

    test('should handle chunking with custom chunk size', async () => {
        const inventoryIds = [system1Id, system2Id, system3Id, system4Id];
        const chunkSize = 2;

        dbSystemsFindAllStub.onFirstCall().resolves([
            { id: system1Id },
            { id: system2Id },
            { id: system3Id },
            { id: system4Id }
        ]);

        dbSystemsFindAllStub.onSecondCall().resolves([
            {
                id: system1Id,
                hostname: 'server1.example.com',
                ansible_hostname: 'ansible1',
                display_name: 'Server 1'
            },
            {
                id: system2Id,
                hostname: 'server2.example.com',
                ansible_hostname: 'ansible2',
                display_name: 'Server 2'
            }
        ]);

        dbSystemsFindAllStub.onThirdCall().resolves([
            {
                id: system3Id,
                hostname: 'server3.example.com',
                ansible_hostname: 'ansible3',
                display_name: 'Server 3'
            },
            {
                id: system4Id,
                hostname: 'server4.example.com',
                ansible_hostname: 'ansible4',
                display_name: 'Server 4'
            }
        ]);

        const result = await queries.getPlanSystemsDetails(inventoryIds, chunkSize);

        result.should.deepEqual({
            [system1Id]: {
                id: system1Id,
                hostname: 'server1.example.com',
                ansible_hostname: 'ansible1',
                display_name: 'Server 1'
            },
            [system2Id]: {
                id: system2Id,
                hostname: 'server2.example.com',
                ansible_hostname: 'ansible2',
                display_name: 'Server 2'
            },
            [system3Id]: {
                id: system3Id,
                hostname: 'server3.example.com',
                ansible_hostname: 'ansible3',
                display_name: 'Server 3'
            },
            [system4Id]: {
                id: system4Id,
                hostname: 'server4.example.com',
                ansible_hostname: 'ansible4',
                display_name: 'Server 4'
            }
        });

        dbSystemsFindAllStub.should.have.been.calledThrice;

        const secondCall = dbSystemsFindAllStub.getCall(1);
        const thirdCall = dbSystemsFindAllStub.getCall(2);

        secondCall.args[0].where.id.should.have.length(2);
        thirdCall.args[0].where.id.should.have.length(2);
        inventoryGetSystemDetailsBatchStub.should.not.have.been.called;
    });

    test('should handle mixed scenario with chunking and missing systems', async () => {
        const inventoryIds = [system1Id, missingSystemId, system3Id];
        const chunkSize = 2;

        dbSystemsFindAllStub.onFirstCall().resolves([
            { id: system1Id },
            { id: system3Id }
        ]);

        inventoryGetSystemDetailsBatchStub.resolves({
            [missingSystemId]: {
                id: missingSystemId,
                hostname: 'fetched-missing.example.com',
                display_name: 'Fetched Missing System',
                ansible_host: 'fetched-ansible'
            }
        });

        dbSystemsFindAllStub.onSecondCall().resolves([
            {
                id: system1Id,
                hostname: 'server1.example.com',
                ansible_hostname: 'ansible1',
                display_name: 'Server 1'
            },
            {
                id: missingSystemId,
                hostname: 'fetched-missing.example.com',
                ansible_hostname: 'fetched-ansible',
                display_name: 'Fetched Missing System'
            }
        ]);

        dbSystemsFindAllStub.onThirdCall().resolves([
            {
                id: system3Id,
                hostname: 'server3.example.com',
                ansible_hostname: 'ansible3',
                display_name: 'Server 3'
            }
        ]);

        const result = await queries.getPlanSystemsDetails(inventoryIds, chunkSize);

        result.should.deepEqual({
            [system1Id]: {
                id: system1Id,
                hostname: 'server1.example.com',
                ansible_hostname: 'ansible1',
                display_name: 'Server 1'
            },
            [missingSystemId]: {
                id: missingSystemId,
                hostname: 'fetched-missing.example.com',
                ansible_hostname: 'fetched-ansible',
                display_name: 'Fetched Missing System'
            },
            [system3Id]: {
                id: system3Id,
                hostname: 'server3.example.com',
                ansible_hostname: 'ansible3',
                display_name: 'Server 3'
            }
        });

        // Should call inventory service for missing system
        inventoryGetSystemDetailsBatchStub.calledOnceWith([missingSystemId], false, 2, false).should.equal(true);
        dbSystemsFindAllStub.should.have.been.calledThrice;

        // Should bulk create the fetched system
        dbSystemsBulkCreateStub.calledOnceWith([{
            id: missingSystemId,
            hostname: 'fetched-missing.example.com',
            display_name: 'Fetched Missing System',
            ansible_hostname: 'fetched-ansible'
        }], {
            ignoreDuplicates: true
        }).should.equal(true);
    });

    test('should pass refresh and strict options to inventory service', async () => {
        const inventoryIds = [missingSystemId];

        dbSystemsFindAllStub.onFirstCall().resolves([]);
        inventoryGetSystemDetailsBatchStub.resolves({
            [missingSystemId]: {
                id: missingSystemId,
                hostname: 'missing-server.example.com',
                display_name: 'Missing Server',
                ansible_host: 'missing-ansible'
            }
        });
        dbSystemsFindAllStub.onSecondCall().resolves([
            {
                id: missingSystemId,
                hostname: 'missing-server.example.com',
                ansible_hostname: 'missing-ansible',
                display_name: 'Missing Server'
            }
        ]);

        const result = await queries.getPlanSystemsDetails(inventoryIds, 50, true, true);

        inventoryGetSystemDetailsBatchStub.calledOnceWith([missingSystemId], true, 2, true).should.equal(true);
        dbSystemsFindAllStub.should.have.been.calledTwice;
        result.should.have.property(missingSystemId);
    });

    test('should handle inventory service returning partial results', async () => {
        const inventoryIds = [missingSystemId, 'another-missing-uuid'];

        dbSystemsFindAllStub.onFirstCall().resolves([]);

        inventoryGetSystemDetailsBatchStub.resolves({
            [missingSystemId]: {
                id: missingSystemId,
                hostname: 'partially-found.example.com',
                display_name: 'Partially Found System',
                ansible_host: 'partially-found-ansible'
            }
        });

        dbSystemsFindAllStub.onSecondCall().resolves([
            {
                id: missingSystemId,
                hostname: 'partially-found.example.com',
                ansible_hostname: 'partially-found-ansible',
                display_name: 'Partially Found System'
            }
        ]);

        const result = await queries.getPlanSystemsDetails(inventoryIds);

        result.should.deepEqual({
            [missingSystemId]: {
                id: missingSystemId,
                hostname: 'partially-found.example.com',
                ansible_hostname: 'partially-found-ansible',
                display_name: 'Partially Found System'
            }
        });

        result.should.not.have.property('another-missing-uuid');
        dbSystemsFindAllStub.should.have.been.calledTwice;
    });
});

describe('remediationExpiresAtSql', function () {
    test('injects retention days and uses playbook_runs', function () {
        const sql = queries.remediationExpiresAtSql(120);
        sql.includes('org_config').should.equal(false);
        sql.includes('playbook_runs').should.equal(true);
        sql.includes('120').should.equal(true);
    });
});

describe('list filter expires_within', function () {
    let findAndCountAllStub;

    beforeEach(() => {
        findAndCountAllStub = base.sandbox.stub(db.remediation, 'findAndCountAll').resolves({count: [], rows: []});
        base.sandbox.stub(db.org_config, 'findByPk').resolves(null);
    });

    async function listWithFilter (expires_within) {
        return queries.list(
            '0000000',
            null,
            false,
            'updated_at',
            true,
            {expires_within},
            false,
            50,
            0
        );
    }

    test('accepts whole number as string and queries', async () => {
        await listWithFilter('30');
        findAndCountAllStub.should.have.been.calledOnce;
    });

    test('accepts whole number and queries', async () => {
        await listWithFilter(30);
        findAndCountAllStub.should.have.been.calledOnce;
    });
});

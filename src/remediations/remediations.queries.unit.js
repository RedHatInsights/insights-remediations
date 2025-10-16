'use strict';

const base = require('../test');
const {v4: uuid} = require('uuid');
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
        
        // Mock existing systems check - all systems exist
        dbSystemsFindAllStub.onFirstCall().resolves([
            { id: system1Id },
            { id: system2Id }
        ]);

        // Mock system details fetch from database  
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
                hostname: 'server1.example.com',
                ansible_hostname: 'ansible1',
                display_name: 'Server 1'
            },
            [system2Id]: {
                hostname: 'server2.example.com',
                ansible_hostname: 'ansible2', 
                display_name: 'Server 2'
            }
        });

        // Should not call inventory service since all systems exist
        inventoryGetSystemDetailsBatchStub.should.not.have.been.called;
        dbSystemsBulkCreateStub.should.not.have.been.called;
    });

    test('should fetch missing systems from inventory service', async () => {
        const inventoryIds = [system1Id, missingSystemId];
        
        // Mock existing systems check - only system1 exists
        dbSystemsFindAllStub.onFirstCall().resolves([
            { id: system1Id }
        ]);

        // Mock inventory service response for missing system
        inventoryGetSystemDetailsBatchStub.resolves({
            [missingSystemId]: {
                id: missingSystemId,
                hostname: 'missing-server.example.com',
                display_name: 'Missing Server',
                ansible_host: 'missing-ansible'
            }
        });

        // Mock system details fetch after inventory call
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
                hostname: 'server1.example.com',
                ansible_hostname: 'ansible1',
                display_name: 'Server 1'
            },
            [missingSystemId]: {
                hostname: 'missing-server.example.com',
                ansible_hostname: 'missing-ansible',
                display_name: 'Missing Server'
            }
        });

        // Should call inventory service for missing system
        inventoryGetSystemDetailsBatchStub.calledOnceWith([missingSystemId]).should.equal(true);
        
        // Should bulk create missing system in database
        dbSystemsBulkCreateStub.calledOnceWith([{
            id: missingSystemId,
            hostname: 'missing-server.example.com',
            display_name: 'Missing Server',
            ansible_hostname: 'missing-ansible'
        }], {
            updateOnDuplicate: ['hostname', 'display_name', 'ansible_hostname', 'updated_at']
        }).should.equal(true);
    });

    test('should handle systems not found anywhere with fallback values', async () => {
        const inventoryIds = [system1Id, missingSystemId];
        
        // Mock existing systems check - only system1 exists
        dbSystemsFindAllStub.onFirstCall().resolves([
            { id: system1Id }
        ]);

        // Mock inventory service returns empty (system not found)
        inventoryGetSystemDetailsBatchStub.resolves({});

        // Mock system details fetch - still only system1 found
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
                hostname: 'server1.example.com',
                ansible_hostname: 'ansible1',
                display_name: 'Server 1'
            },
            [missingSystemId]: {
                hostname: null,
                ansible_hostname: null,
                display_name: null
            }
        });

        // Should try inventory service but system wasn't found
        inventoryGetSystemDetailsBatchStub.calledOnceWith([missingSystemId]).should.equal(true);
        
        // Should not bulk create since no systems returned from inventory
        dbSystemsBulkCreateStub.called.should.equal(false);
    });

    test('should handle chunking with custom chunk size', async () => {
        const inventoryIds = [system1Id, system2Id, system3Id, system4Id];
        const chunkSize = 2; // Force chunking
        
        // Mock existing systems check - all systems exist
        dbSystemsFindAllStub.onFirstCall().resolves([
            { id: system1Id },
            { id: system2Id },
            { id: system3Id },
            { id: system4Id }
        ]);

        // Mock system details fetch for first chunk
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

        // Mock system details fetch for second chunk
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
                hostname: 'server1.example.com',
                ansible_hostname: 'ansible1',
                display_name: 'Server 1'
            },
            [system2Id]: {
                hostname: 'server2.example.com',
                ansible_hostname: 'ansible2',
                display_name: 'Server 2'
            },
            [system3Id]: {
                hostname: 'server3.example.com',
                ansible_hostname: 'ansible3',
                display_name: 'Server 3'
            },
            [system4Id]: {
                hostname: 'server4.example.com',
                ansible_hostname: 'ansible4',
                display_name: 'Server 4'
            }
        });

        // Should make 3 database calls total (1 for existing check + 2 chunks)
        dbSystemsFindAllStub.should.have.been.calledThrice;
        
        // Verify chunk sizes
        const secondCall = dbSystemsFindAllStub.getCall(1);
        const thirdCall = dbSystemsFindAllStub.getCall(2);
        
        secondCall.args[0].where.id.should.have.length(2); // First chunk
        thirdCall.args[0].where.id.should.have.length(2);  // Second chunk
    });

    test('should handle mixed scenario with chunking and missing systems', async () => {
        const inventoryIds = [system1Id, missingSystemId, system3Id];
        const chunkSize = 2;
        
        // Mock existing systems check - system1 and system3 exist, missingSystemId doesn't
        dbSystemsFindAllStub.onFirstCall().resolves([
            { id: system1Id },
            { id: system3Id }
        ]);

        // Mock inventory service response for missing system
        inventoryGetSystemDetailsBatchStub.resolves({
            [missingSystemId]: {
                id: missingSystemId,
                hostname: 'fetched-missing.example.com',
                display_name: 'Fetched Missing System',
                ansible_host: 'fetched-ansible'
            }
        });

        // Mock system details fetch for first chunk
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

        // Mock system details fetch for second chunk  
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
                hostname: 'server1.example.com',
                ansible_hostname: 'ansible1',
                display_name: 'Server 1'
            },
            [missingSystemId]: {
                hostname: 'fetched-missing.example.com',
                ansible_hostname: 'fetched-ansible',
                display_name: 'Fetched Missing System'
            },
            [system3Id]: {
                hostname: 'server3.example.com',
                ansible_hostname: 'ansible3',
                display_name: 'Server 3'
            }
        });

        // Should call inventory service for missing system
        inventoryGetSystemDetailsBatchStub.calledOnceWith([missingSystemId]).should.equal(true);
        
        // Should bulk create the fetched system
        dbSystemsBulkCreateStub.calledOnceWith([{
            id: missingSystemId,
            hostname: 'fetched-missing.example.com',
            display_name: 'Fetched Missing System',
            ansible_hostname: 'fetched-ansible'
        }], {
            updateOnDuplicate: ['hostname', 'display_name', 'ansible_hostname', 'updated_at']
        }).should.equal(true);
    });

    test('should handle inventory service returning partial results', async () => {
        const inventoryIds = [missingSystemId, 'another-missing-uuid'];
        
        // Mock existing systems check - no systems exist
        dbSystemsFindAllStub.onFirstCall().resolves([]);

        // Mock inventory service returns only one of the missing systems
        inventoryGetSystemDetailsBatchStub.resolves({
            [missingSystemId]: {
                id: missingSystemId,
                hostname: 'partially-found.example.com',
                display_name: 'Partially Found System',
                ansible_host: 'partially-found-ansible'
            }
            // 'another-missing-uuid' not returned by inventory
        });

        // Mock system details fetch - only the one found in inventory
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
                hostname: 'partially-found.example.com',
                ansible_hostname: 'partially-found-ansible',
                display_name: 'Partially Found System'
            },
            'another-missing-uuid': {
                hostname: null,
                ansible_hostname: null,
                display_name: null
            }
        });
    });
});

'use strict';

const base = require('../test');
const {v4: uuid} = require('uuid');
const queries = require('./remediations.queries');
const db = require('../db');

describe('getPlanSystemsDetails', function () {
    const system1Id = 'f6b7a1c2-3d4e-5f6a-7b8c-9d0e1f2a3b4c';
    const system2Id = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const system3Id = 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e';
    const system4Id = 'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f';
    const missingSystemId = '00000000-0000-0000-0000-000000000000';

    let dbSystemsFindAllStub;

    beforeEach(() => {
        dbSystemsFindAllStub = base.sandbox.stub(db.systems, 'findAll');
    });

    test('should return empty object for empty input', async () => {
        const result = await queries.getPlanSystemsDetails([]);
        result.should.deepEqual({});
        
        // No database calls should be made
        dbSystemsFindAllStub.should.not.have.been.called;
    });

    test('should return empty object for null input', async () => {
        const result = await queries.getPlanSystemsDetails(null);
        result.should.deepEqual({});
        
        // No database calls should be made
        dbSystemsFindAllStub.should.not.have.been.called;
    });

    test('should fetch system details from database', async () => {
        const inventoryIds = [system1Id, system2Id];
        
        // Mock system details fetch from database  
        dbSystemsFindAllStub.resolves([
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

        // Should call database once
        dbSystemsFindAllStub.should.have.been.calledOnce;
    });

    test('should handle systems not found in database with fallback values', async () => {
        const inventoryIds = [system1Id, missingSystemId];
        
        // Mock system details fetch - only system1 found in database
        dbSystemsFindAllStub.resolves([
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

        // Should call database once
        dbSystemsFindAllStub.should.have.been.calledOnce;
    });

    test('should handle chunking with custom chunk size', async () => {
        const inventoryIds = [system1Id, system2Id, system3Id, system4Id];
        const chunkSize = 2; // Force chunking
        
        // Mock system details fetch for first chunk
        dbSystemsFindAllStub.onFirstCall().resolves([
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
        dbSystemsFindAllStub.onSecondCall().resolves([
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

        // Should make 2 database calls (one per chunk)
        dbSystemsFindAllStub.should.have.been.calledTwice;
        
        // Verify chunk sizes
        const firstCall = dbSystemsFindAllStub.getCall(0);
        const secondCall = dbSystemsFindAllStub.getCall(1);
        
        firstCall.args[0].where.id.should.have.length(2); // First chunk
        secondCall.args[0].where.id.should.have.length(2);  // Second chunk
    });

    test('should handle partial results from database', async () => {
        const inventoryIds = [system1Id, missingSystemId];
        
        // Mock system details fetch - only system1 found in database
        dbSystemsFindAllStub.resolves([
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

        // Should call database once
        dbSystemsFindAllStub.should.have.been.calledOnce;
    });
});

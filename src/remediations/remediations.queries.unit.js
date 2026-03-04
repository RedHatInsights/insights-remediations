'use strict';

const base = require('../test');
const sinon = require('sinon');
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

describe('list with expiration_date filter and sort', function () {
    const tenant_org_id = '3333333';
    const created_by = 'testuser@redhat.com';

    let sandbox;
    let findAndCountAllStub;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        findAndCountAllStub = sandbox.stub(db.remediation, 'findAndCountAll');
        findAndCountAllStub.resolves({ count: [0], rows: [] });
    });

    afterEach(() => {
        sandbox.restore();
    });

    test('adds expiration_before to where when filter.expiration_before is set', async () => {
        await queries.list(tenant_org_id, created_by, false, 'updated_at', true, { expiration_before: '2026-12-31' }, false, 50, 0);

        sinon.assert.calledOnce(findAndCountAllStub);
        const query = findAndCountAllStub.firstCall.args[0];
        query.should.have.property('where');
        query.where.should.have.property('expiration_date');
        const exp = query.where.expiration_date;
        exp.should.have.property(db.Op.lte);
        new Date(exp[db.Op.lte]).toISOString().should.startWith('2026-12-31');
    });

    test('adds expiration_after to where when filter.expiration_after is set', async () => {
        await queries.list(tenant_org_id, created_by, false, 'updated_at', true, { expiration_after: '2026-01-01' }, false, 50, 0);

        sinon.assert.calledOnce(findAndCountAllStub);
        const query = findAndCountAllStub.firstCall.args[0];
        query.where.should.have.property('expiration_date');
        const exp = query.where.expiration_date;
        exp.should.have.property(db.Op.gte);
        new Date(exp[db.Op.gte]).toISOString().should.startWith('2026-01-01');
    });

    test('adds both expiration_before and expiration_after when both are set', async () => {
        await queries.list(tenant_org_id, created_by, false, 'updated_at', true, {
            expiration_before: '2026-12-31',
            expiration_after: '2026-01-01'
        }, false, 50, 0);

        sinon.assert.calledOnce(findAndCountAllStub);
        const query = findAndCountAllStub.firstCall.args[0];
        query.where.should.have.property('expiration_date');
        query.where.expiration_date.should.have.property(db.Op.and);
        const andConditions = query.where.expiration_date[db.Op.and];
        andConditions.should.have.length(2);
    });

    test('adds expiring_within_days range when filter.expiring_within_days is set', async () => {
        await queries.list(tenant_org_id, created_by, false, 'updated_at', true, { expiring_within_days: '30' }, false, 50, 0);

        sinon.assert.calledOnce(findAndCountAllStub);
        const query = findAndCountAllStub.firstCall.args[0];
        query.where.should.have.property('expiration_date');
        query.where.expiration_date.should.have.property(db.Op.and);
        const andConditions = query.where.expiration_date[db.Op.and];
        andConditions.should.have.length(2);
    });

    test('ignores invalid expiring_within_days (negative) and does not add expiration_date', async () => {
        await queries.list(tenant_org_id, created_by, false, 'updated_at', true, { expiring_within_days: '-1' }, false, 50, 0);

        sinon.assert.calledOnce(findAndCountAllStub);
        const query = findAndCountAllStub.firstCall.args[0];
        query.where.should.not.have.property('expiration_date');
    });

    test('sorts by expiration_date when primaryOrder is expiration_date', async () => {
        await queries.list(tenant_org_id, created_by, false, 'expiration_date', true, false, false, 50, 0);

        sinon.assert.calledOnce(findAndCountAllStub);
        const query = findAndCountAllStub.firstCall.args[0];
        query.should.have.property('order');
        query.order.should.be.an.Array();
        query.order[0].should.be.an.Array();
        query.order[0][1].should.equal('ASC');
    });

    test('sorts by -expiration_date when primaryOrder is expiration_date and asc is false', async () => {
        await queries.list(tenant_org_id, created_by, false, 'expiration_date', false, false, false, 50, 0);

        sinon.assert.calledOnce(findAndCountAllStub);
        const query = findAndCountAllStub.firstCall.args[0];
        query.order[0][1].should.equal('DESC');
    });
});

'use strict';

require('should');
const sinon = require('sinon');
const db = require('../db');
const { cullOldRemediations, getCutoffDate, DEFAULT_BATCH_SIZE, DEFAULT_RETENTION_DAYS } = require('./cullOldRemediations');

describe('cullOldRemediations', function () {
    let sandbox;
    let dbConnectStub;
    let dbCloseStub;
    let remediationFindAllStub;
    let remediationDestroyStub;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        dbConnectStub = sandbox.stub(db, 'connect').resolves();
        dbCloseStub = sandbox.stub(db, 'close').resolves();

        // Mock the remediation model
        db.remediation = {
            findAll: sandbox.stub(),
            destroy: sandbox.stub()
        };
        remediationFindAllStub = db.remediation.findAll;
        remediationDestroyStub = db.remediation.destroy;
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('getCutoffDate', function () {
        test('should return a date in the past based on retention days', () => {
            const retentionDays = 30;
            const now = new Date();
            const cutoff = getCutoffDate(retentionDays);

            // Cutoff should be approximately 30 days ago
            const expectedDate = new Date(now);
            expectedDate.setDate(expectedDate.getDate() - retentionDays);

            // Allow for small time differences during test execution
            const diffMs = Math.abs(cutoff.getTime() - expectedDate.getTime());
            diffMs.should.be.lessThan(1000); // Within 1 second
        });

        test('should handle default retention period of 270 days', () => {
            const cutoff = getCutoffDate(DEFAULT_RETENTION_DAYS);
            const now = new Date();
            const expectedDate = new Date(now);
            expectedDate.setDate(expectedDate.getDate() - DEFAULT_RETENTION_DAYS);

            const diffMs = Math.abs(cutoff.getTime() - expectedDate.getTime());
            diffMs.should.be.lessThan(1000);
        });

        test('should handle retention period of 0 days', () => {
            const cutoff = getCutoffDate(0);
            const now = new Date();

            const diffMs = Math.abs(cutoff.getTime() - now.getTime());
            diffMs.should.be.lessThan(1000);
        });
    });

    describe('culling logic', function () {
        test('should delete old remediations and preserve recent ones', async () => {
            const oldRemediationId1 = '11111111-1111-1111-1111-111111111111';
            const oldRemediationId2 = '22222222-2222-2222-2222-222222222222';

            // First call returns old remediations
            remediationFindAllStub.onFirstCall().resolves([
                { id: oldRemediationId1 },
                { id: oldRemediationId2 }
            ]);
            // Second call returns empty (no more old remediations)
            remediationFindAllStub.onSecondCall().resolves([]);

            remediationDestroyStub.resolves(2);

            const totalDeleted = await cullOldRemediations();

            totalDeleted.should.equal(2);
            dbConnectStub.calledOnce.should.be.true();
            dbCloseStub.calledOnce.should.be.true();
            remediationDestroyStub.calledOnce.should.be.true();

            // Verify destroy was called with correct IDs
            const destroyCall = remediationDestroyStub.getCall(0);
            destroyCall.args[0].where.id[Object.getOwnPropertySymbols(destroyCall.args[0].where.id)[0]]
                .should.containDeep([oldRemediationId1, oldRemediationId2]);
        });

        test('should handle no remediations to delete', async () => {
            remediationFindAllStub.resolves([]);

            const totalDeleted = await cullOldRemediations();

            totalDeleted.should.equal(0);
            dbConnectStub.calledOnce.should.be.true();
            dbCloseStub.calledOnce.should.be.true();
            remediationDestroyStub.called.should.be.false();
        });

        test('should process multiple batches', async () => {
            // Create arrays of remediation IDs for multiple batches
            const batch1 = Array.from({ length: DEFAULT_BATCH_SIZE }, (_, i) => ({
                id: `batch1-${i.toString().padStart(4, '0')}-0000-0000-000000000000`
            }));
            const batch2 = Array.from({ length: 500 }, (_, i) => ({
                id: `batch2-${i.toString().padStart(4, '0')}-0000-0000-000000000000`
            }));

            remediationFindAllStub.onCall(0).resolves(batch1);
            remediationFindAllStub.onCall(1).resolves(batch2);
            remediationFindAllStub.onCall(2).resolves([]);

            remediationDestroyStub.onCall(0).resolves(DEFAULT_BATCH_SIZE);
            remediationDestroyStub.onCall(1).resolves(500);

            const totalDeleted = await cullOldRemediations();

            totalDeleted.should.equal(DEFAULT_BATCH_SIZE + 500);
            remediationFindAllStub.callCount.should.equal(3);
            remediationDestroyStub.callCount.should.equal(2);
        });

        test('should use correct batch size limit', async () => {
            remediationFindAllStub.resolves([]);

            await cullOldRemediations();

            const findAllCall = remediationFindAllStub.getCall(0);
            findAllCall.args[0].limit.should.equal(DEFAULT_BATCH_SIZE);
        });

        test('should query using updated_at field with less than cutoff date', async () => {
            remediationFindAllStub.resolves([]);

            await cullOldRemediations();

            const findAllCall = remediationFindAllStub.getCall(0);
            findAllCall.args[0].should.have.property('where');
            findAllCall.args[0].where.should.have.property('updated_at');
            findAllCall.args[0].attributes.should.containDeep(['id']);
            findAllCall.args[0].raw.should.be.true();
        });

        test('should close database connection even on error', async () => {
            remediationFindAllStub.rejects(new Error('Database error'));

            await cullOldRemediations().should.be.rejectedWith('Database error');

            dbCloseStub.calledOnce.should.be.true();
        });

        test('should use environment variable for retention days', async () => {
            const originalEnv = process.env.REMEDIATION_RETENTION_DAYS;
            process.env.REMEDIATION_RETENTION_DAYS = '30';

            remediationFindAllStub.resolves([]);

            await cullOldRemediations();

            const findAllCall = remediationFindAllStub.getCall(0);
            const whereClause = findAllCall.args[0].where;
            const opLt = Object.getOwnPropertySymbols(whereClause.updated_at)[0];
            const cutoffDate = whereClause.updated_at[opLt];

            // Verify cutoff is approximately 30 days ago
            const now = new Date();
            const expectedCutoff = new Date(now);
            expectedCutoff.setDate(expectedCutoff.getDate() - 30);

            const diffMs = Math.abs(cutoffDate.getTime() - expectedCutoff.getTime());
            diffMs.should.be.lessThan(1000);

            // Restore environment
            if (originalEnv === undefined) {
                delete process.env.REMEDIATION_RETENTION_DAYS;
            } else {
                process.env.REMEDIATION_RETENTION_DAYS = originalEnv;
            }
        });

        test('should use default retention days when env var is not set', async () => {
            const originalEnv = process.env.REMEDIATION_RETENTION_DAYS;
            delete process.env.REMEDIATION_RETENTION_DAYS;

            remediationFindAllStub.resolves([]);

            await cullOldRemediations();

            const findAllCall = remediationFindAllStub.getCall(0);
            const whereClause = findAllCall.args[0].where;
            const opLt = Object.getOwnPropertySymbols(whereClause.updated_at)[0];
            const cutoffDate = whereClause.updated_at[opLt];

            // Verify cutoff is approximately 270 days ago (default)
            const now = new Date();
            const expectedCutoff = new Date(now);
            expectedCutoff.setDate(expectedCutoff.getDate() - DEFAULT_RETENTION_DAYS);

            const diffMs = Math.abs(cutoffDate.getTime() - expectedCutoff.getTime());
            diffMs.should.be.lessThan(1000);

            // Restore environment
            if (originalEnv !== undefined) {
                process.env.REMEDIATION_RETENTION_DAYS = originalEnv;
            }
        });

        test('should use default retention days when env var is invalid', async () => {
            const originalEnv = process.env.REMEDIATION_RETENTION_DAYS;
            process.env.REMEDIATION_RETENTION_DAYS = 'invalid';

            remediationFindAllStub.resolves([]);

            await cullOldRemediations();

            const findAllCall = remediationFindAllStub.getCall(0);
            const whereClause = findAllCall.args[0].where;
            const opLt = Object.getOwnPropertySymbols(whereClause.updated_at)[0];
            const cutoffDate = whereClause.updated_at[opLt];

            // Verify cutoff is approximately 270 days ago (default)
            const now = new Date();
            const expectedCutoff = new Date(now);
            expectedCutoff.setDate(expectedCutoff.getDate() - DEFAULT_RETENTION_DAYS);

            const diffMs = Math.abs(cutoffDate.getTime() - expectedCutoff.getTime());
            diffMs.should.be.lessThan(1000);

            // Restore environment
            if (originalEnv === undefined) {
                delete process.env.REMEDIATION_RETENTION_DAYS;
            } else {
                process.env.REMEDIATION_RETENTION_DAYS = originalEnv;
            }
        });

        test('should use environment variable for batch size', async () => {
            const originalEnv = process.env.REMEDIATION_CULL_BATCH_SIZE;
            process.env.REMEDIATION_CULL_BATCH_SIZE = '500';

            remediationFindAllStub.resolves([]);

            await cullOldRemediations();

            const findAllCall = remediationFindAllStub.getCall(0);
            findAllCall.args[0].limit.should.equal(500);

            // Restore environment
            if (originalEnv === undefined) {
                delete process.env.REMEDIATION_CULL_BATCH_SIZE;
            } else {
                process.env.REMEDIATION_CULL_BATCH_SIZE = originalEnv;
            }
        });

        test('should use default batch size when env var is not set', async () => {
            const originalEnv = process.env.REMEDIATION_CULL_BATCH_SIZE;
            delete process.env.REMEDIATION_CULL_BATCH_SIZE;

            remediationFindAllStub.resolves([]);

            await cullOldRemediations();

            const findAllCall = remediationFindAllStub.getCall(0);
            findAllCall.args[0].limit.should.equal(DEFAULT_BATCH_SIZE);

            // Restore environment
            if (originalEnv !== undefined) {
                process.env.REMEDIATION_CULL_BATCH_SIZE = originalEnv;
            }
        });

        test('should use default batch size when env var is invalid', async () => {
            const originalEnv = process.env.REMEDIATION_CULL_BATCH_SIZE;
            process.env.REMEDIATION_CULL_BATCH_SIZE = 'invalid';

            remediationFindAllStub.resolves([]);

            await cullOldRemediations();

            const findAllCall = remediationFindAllStub.getCall(0);
            findAllCall.args[0].limit.should.equal(DEFAULT_BATCH_SIZE);

            // Restore environment
            if (originalEnv === undefined) {
                delete process.env.REMEDIATION_CULL_BATCH_SIZE;
            } else {
                process.env.REMEDIATION_CULL_BATCH_SIZE = originalEnv;
            }
        });
    });

    describe('constants', function () {
        test('DEFAULT_RETENTION_DAYS should be 270 (approximately 9 months)', () => {
            DEFAULT_RETENTION_DAYS.should.equal(270);
        });

        test('DEFAULT_BATCH_SIZE should be 1000', () => {
            DEFAULT_BATCH_SIZE.should.equal(1000);
        });
    });
});

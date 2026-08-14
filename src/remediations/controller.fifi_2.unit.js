'use strict';

const sinon = require('sinon');
const should = require('should');

const controller = require('./controller.fifi_2');
const queries = require('./remediations.queries');
const errors = require('../errors');

describe('remediations controller.fifi_2 unit tests', function () {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('executePlaybookRuns - service account authorization', function () {
        const remediationId = 'cbc782e4-e8ae-4807-82ab-505387981d2e';
        let mockReq;
        let mockRes;
        let mockNext;

        beforeEach(() => {
            mockReq = {
                params: { id: remediationId },
                body: { exclude: [] },
                headers: {},
                user: {
                    tenant_org_id: '0000000',
                    username: 'test-service-account'
                },
                type: 'ServiceAccount'
            };
            mockRes = {
                sendStatus: sandbox.stub(),
                status: sandbox.stub().returnsThis(),
                json: sandbox.stub(),
                set: sandbox.stub(),
                send: sandbox.stub(),
                end: sandbox.stub()
            };
            mockNext = sandbox.stub();
        });

        it('returns 403 when service account executes another user plan', async () => {
            sandbox.stub(queries, 'get').resolves(null);
            sandbox.stub(queries, 'checkPlanExistence').resolves({ id: remediationId });

            // errors.async forwards the rejection to next(); await also sees it
            await controller.executePlaybookRuns(mockReq, mockRes, mockNext).catch(() => {});

            sinon.assert.calledOnce(queries.get);
            sinon.assert.calledWithExactly(queries.get, remediationId, '0000000', 'test-service-account');
            sinon.assert.calledOnce(queries.checkPlanExistence);
            sinon.assert.calledWithExactly(queries.checkPlanExistence, remediationId, '0000000', null);

            sinon.assert.calledOnce(mockNext);
            const err = mockNext.firstCall.args[0];
            should(err).be.instanceOf(errors.Forbidden);
            should(err.getError().code).equal('FORBIDDEN');
            should(err.getError().status).equal(403);
            should(err.getError().details.message).equal(
                'Service accounts cannot execute remediation plans created by other users.'
            );
            sinon.assert.notCalled(mockRes.sendStatus);
        });

        it('returns 404 when service account executes a non-existent plan', async () => {
            sandbox.stub(queries, 'get').resolves(null);
            sandbox.stub(queries, 'checkPlanExistence').resolves(null);

            await controller.executePlaybookRuns(mockReq, mockRes, mockNext);

            sinon.assert.calledOnce(queries.checkPlanExistence);
            sinon.assert.calledWith(mockRes.sendStatus, 404);
            sinon.assert.notCalled(mockNext);
        });

        it('returns 404 for regular users without checking org-wide existence', async () => {
            mockReq.type = 'User';
            mockReq.user.username = 'other-user@redhat.com';
            sandbox.stub(queries, 'get').resolves(null);
            sandbox.stub(queries, 'checkPlanExistence').resolves({ id: remediationId });

            await controller.executePlaybookRuns(mockReq, mockRes, mockNext);

            sinon.assert.calledOnce(queries.get);
            sinon.assert.notCalled(queries.checkPlanExistence);
            sinon.assert.calledWith(mockRes.sendStatus, 404);
            sinon.assert.notCalled(mockNext);
        });
    });
});

'use strict';

const should = require('should');
const sinon = require('sinon');

const config = require('../config');
const featureFlags = require('../connectors/featureFlags');
const errors = require('../errors');
const queries = require('./remediations.queries');
const controller = require('./controller.fifi_2');
const { calculateActionPoints, validatePlanSize } = controller;

const req = {
    user: {
        username: 'tester',
        tenant_org_id: '123',
        account_number: '456'
    }
};

describe('calculateActionPoints', function () {
    test('returns 0 for empty or missing issues', () => {
        calculateActionPoints([]).should.equal(0);
        calculateActionPoints(null).should.equal(0);
        calculateActionPoints(undefined).should.equal(0);
    });

    test('scores issues by type to match the frontend', () => {
        calculateActionPoints([
            {issue_id: 'advisor:rule|RULE'},
            {issue_id: 'vulnerabilities:CVE-2024-1234'},
            {issue_id: 'patch-advisory:RHBA-2019:4105'},
            {issue_id: 'patch-package:rpm-4.14.2-37.el8.x86_64'},
            {issue_id: 'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_service_autofs_disabled'}
        ]).should.equal(20 + 20 + 2 + 2 + 5);
    });

    test('uses issue.id when issue_id is absent', () => {
        calculateActionPoints([{id: 'advisor:rule|RULE'}]).should.equal(20);
    });

    test('treats test issues as 0 points', () => {
        calculateActionPoints([{issue_id: 'test:ping'}]).should.equal(0);
    });

    test('multiplies points by the number of issues of each type', () => {
        calculateActionPoints([
            {issue_id: 'advisor:one|ONE'},
            {issue_id: 'advisor:two|TWO'},
            {issue_id: 'ssg:rhel8|cis|xccdf_org.ssgproject.content_rule_selinux_policytype'}
        ]).should.equal(45);
    });
});

describe('validatePlanSize', function () {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(featureFlags, 'isEnabled').returns(false);
        sandbox.stub(config.planLimits, 'maxSystems').value(100);
        sandbox.stub(config.planLimits, 'maxActionPoints').value(1000);
    });

    afterEach(() => {
        sandbox.restore();
    });

    test('allows plans at the system and action-point limits', () => {
        const issues = Array.from({length: 50}, (_, i) => ({issue_id: `advisor:rule${i}|RULE`}));
        validatePlanSize(issues, 100, req);
    });

    test('rejects plans with more than 100 systems', () => {
        try {
            validatePlanSize([], 101, req);
            throw new Error('expected PLAN_SIZE_LIMIT_EXCEEDED');
        } catch (error) {
            error.should.be.instanceof(errors.BadRequest);
            error.error.code.should.equal('PLAN_SIZE_LIMIT_EXCEEDED');
            error.error.title.should.match(/101 systems/);
        }
    });

    test('rejects plans with more than 1000 action points', () => {
        const issues = Array.from({length: 51}, (_, i) => ({issue_id: `advisor:rule${i}|RULE`}));

        try {
            validatePlanSize(issues, 1, req);
            throw new Error('expected PLAN_SIZE_LIMIT_EXCEEDED');
        } catch (error) {
            error.should.be.instanceof(errors.BadRequest);
            error.error.code.should.equal('PLAN_SIZE_LIMIT_EXCEEDED');
            error.error.title.should.match(/1020 action points/);
        }
    });

    test('skips limits when the bypass feature flag is enabled', () => {
        featureFlags.isEnabled.returns(true);
        const issues = Array.from({length: 51}, (_, i) => ({issue_id: `advisor:rule${i}|RULE`}));
        validatePlanSize(issues, 101, req);
    });
});

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

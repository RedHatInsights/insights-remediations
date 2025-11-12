'use strict';

const _ = require('lodash');
const sinon = require('sinon');
const should = require('should');

const readController = require('./controller.read');
const queries = require('./remediations.queries');
const errors = require('../errors');

describe('remediations controller.read unit tests', function () {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('playbook function - service account filtering', function () {
        let mockReq, mockRes, mockNext;

        beforeEach(() => {
            mockReq = {
                params: { id: 'test-remediation-id' },
                query: {},
                identity: { org_id: 'test-org-id' },
                user: { username: 'testuser@redhat.com' },
                type: 'User'
            };
            mockRes = {
                status: sandbox.stub().returnsThis(),
                json: sandbox.stub(),
                sendStatus: sandbox.stub(),
                set: sandbox.stub(),
                send: sandbox.stub(),
                end: sandbox.stub()
            };
            mockNext = sandbox.stub();
        });

        it('should filter by creator when user type is User', async () => {
            // Arrange
            const expectedCreator = 'testuser@redhat.com';
            sandbox.stub(queries, 'get').resolves({
                id: 'test-remediation-id',
                issues: [],
                auto_reboot: false
            });

            // Act
            await readController.playbook(mockReq, mockRes, mockNext);

            // Assert
            sinon.assert.calledOnce(queries.get);
            const callArgs = queries.get.getCall(0).args;
            should(callArgs[0]).equal('test-remediation-id');
            should(callArgs[1]).equal('test-org-id');
            should(callArgs[2]).equal(expectedCreator); // creator_sa_filter should be the username
        });

        it('should not filter by creator when user type is ServiceAccount', async () => {
            // Arrange
            mockReq.type = 'ServiceAccount';
            mockReq.user = {
                account_number: '',
                tenant_org_id: 'test-org-id',
                username: 'test-service-account',
                is_internal: false
            };
            
            sandbox.stub(queries, 'get').resolves({
                id: 'test-remediation-id',
                issues: [],
                auto_reboot: false
            });

            // Act
            await readController.playbook(mockReq, mockRes, mockNext);

            // Assert
            sinon.assert.calledOnce(queries.get);
            const callArgs = queries.get.getCall(0).args;
            should(callArgs[0]).equal('test-remediation-id');
            should(callArgs[1]).equal('test-org-id');
            should(callArgs[2]).equal(null); // creator_sa_filter should be null for service accounts
        });

        it('should handle cert_auth case correctly', async () => {
            // Arrange
            mockReq.user = undefined; // cert_auth case
            mockReq.type = 'User'; // This should be set by middleware
            sandbox.stub(queries, 'get').resolves({
                id: 'test-remediation-id',
                issues: [],
                auto_reboot: false
            });

            // Act
            await readController.playbook(mockReq, mockRes, mockNext);

            // Assert
            sinon.assert.calledOnce(queries.get);
            const callArgs = queries.get.getCall(0).args;
            should(callArgs[0]).equal('test-remediation-id');
            should(callArgs[1]).equal('test-org-id');
            should(callArgs[2]).equal(null); // creator should be null for cert_auth
        });

        it('should handle service account with cert_auth correctly', async () => {
            // Arrange
            mockReq.user = undefined; // cert_auth case
            mockReq.type = 'ServiceAccount';
            sandbox.stub(queries, 'get').resolves({
                id: 'test-remediation-id',
                issues: [],
                auto_reboot: false
            });

            // Act
            await readController.playbook(mockReq, mockRes, mockNext);

            // Assert
            sinon.assert.calledOnce(queries.get);
            const callArgs = queries.get.getCall(0).args;
            should(callArgs[0]).equal('test-remediation-id');
            should(callArgs[1]).equal('test-org-id');
            should(callArgs[2]).equal(null); // creator_sa_filter should be null for service accounts
        });
    });

    describe('list function - service account filtering', function () {
        let mockReq, mockRes, mockNext;

        beforeEach(() => {
            mockReq = {
                query: { sort: 'updated_at' },
                user: {
                    tenant_org_id: 'test-org-id',
                    username: 'testuser@redhat.com'
                },
                type: 'User'
            };
            mockRes = {
                json: sandbox.stub()
            };
            mockNext = sandbox.stub();
        });

        it('should pass username to queries.list when user type is User', async () => {
            // Arrange
            const expectedUsername = 'testuser@redhat.com';
            sandbox.stub(queries, 'list').resolves({
                count: [{ count: 0 }],
                rows: []
            });
            sandbox.stub(queries, 'loadDetails').resolves([]);

            // Act
            await readController.list(mockReq, mockRes, mockNext);

            // Assert
            sinon.assert.calledOnce(queries.list);
            const callArgs = queries.list.getCall(0).args;
            should(callArgs[0]).equal('test-org-id');
            should(callArgs[1]).equal(expectedUsername); // created_by should be the username
        });

        it('should pass null to queries.list when user type is ServiceAccount', async () => {
            // Arrange
            mockReq.type = 'ServiceAccount';
            mockReq.user = {
                account_number: '',
                tenant_org_id: 'test-org-id',
                username: 'test-service-account',
                is_internal: false
            };
            
            sandbox.stub(queries, 'list').resolves({
                count: [{ count: 0 }],
                rows: []
            });
            sandbox.stub(queries, 'loadDetails').resolves([]);

            // Act
            await readController.list(mockReq, mockRes, mockNext);

            // Assert
            sinon.assert.calledOnce(queries.list);
            const callArgs = queries.list.getCall(0).args;
            should(callArgs[0]).equal('test-org-id');
            should(callArgs[1]).equal(null); // created_by should be null for service accounts
        });
    });
});
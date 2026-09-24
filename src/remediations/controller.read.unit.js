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

        it('should keep DB name order and not re-sort the page in JS', async () => {
            // DB collation and JS toLowerCase() disagree on '_' vs letters, so a
            // post-query JS sort would reshuffle items within a page (RHINENG-27972).
            mockReq.query = { sort: '-name', limit: 15, offset: 0 };
            mockReq.identity = {};

            const now = new Date('2018-10-04T08:19:36.641Z');
            const dbOrder = [
                { id: '11111111-1111-1111-1111-111111111111', name: 'test_rhel9_remed' },
                { id: '22222222-2222-2222-2222-222222222222', name: 'test_rhel9_rem' },
                { id: '33333333-3333-3333-3333-333333333333', name: 'testing123' }
            ];

            function details (id, name) {
                return {
                    id,
                    name,
                    created_by: 'tuser@redhat.com',
                    updated_by: 'tuser@redhat.com',
                    created_at: now,
                    updated_at: now,
                    system_count: 0,
                    issue_count: 0,
                    resolved_count: 0,
                    archived: false,
                    last_run_at: null,
                    expires_at: now,
                    issues: []
                };
            }

            sandbox.stub(queries, 'list').resolves({
                count: dbOrder.map(() => ({ count: 1 })),
                rows: dbOrder.map(({id}) => ({ id }))
            });
            sandbox.stub(queries, 'loadDetails').resolves(
                dbOrder.map(({id, name}) => details(id, name))
            );

            await readController.list(mockReq, mockRes, mockNext);

            sinon.assert.calledOnce(mockRes.json);
            sinon.assert.notCalled(mockNext);
            const names = mockRes.json.getCall(0).args[0].data.map(r => r.name);
            should(names).eql(['test_rhel9_remed', 'test_rhel9_rem', 'testing123']);
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
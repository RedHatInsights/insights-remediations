'use strict';

const sinon = require('sinon');
const should = require('should');

const controller = require('./controller.fifi');
const queries = require('./remediations.queries');
const fifi = require('./fifi');
const errors = require('../errors');

describe('controller.fifi listPlaybookRuns', function () {
    let sandbox;
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        mockReq = {
            params: { id: '63d92aeb-9351-4216-8d7c-044d171337bc' },
            query: { sort: '-updated_at', limit: 50, offset: 10 },
            user: {
                tenant_org_id: '0000000',
                username: 'test-user'
            }
        };
        mockRes = {
            status: sandbox.stub().returnsThis(),
            send: sandbox.stub(),
            sendStatus: sandbox.stub()
        };
        mockNext = sandbox.stub();
    });

    afterEach(() => {
        sandbox.restore();
    });

    test('throws INVALID_OFFSET when offset is out of range', async () => {
        sandbox.stub(queries, 'getPlaybookRuns').resolves({
            toJSON: () => ({ playbook_runs: [{ id: 'run-1' }, { id: 'run-2' }] })
        });
        sandbox.stub(fifi, 'combineRuns').resolves([{ id: 'run-1' }, { id: 'run-2' }]);
        sandbox.stub(fifi, 'resolveUsers');
        sandbox.stub(fifi, 'updatePlaybookRunsStatus');

        await controller.listPlaybookRuns(mockReq, mockRes, mockNext).catch(() => {});

        sinon.assert.calledOnce(mockNext);
        const err = mockNext.firstCall.args[0];
        should(err).be.instanceOf(errors.BadRequest);
        should(err.getError().code).equal('INVALID_OFFSET');
        should(err.getError().title).equal('Requested starting offset 10 out of range: [0, 2]');
        sinon.assert.notCalled(mockRes.send);
        sinon.assert.notCalled(fifi.resolveUsers);
    });
});

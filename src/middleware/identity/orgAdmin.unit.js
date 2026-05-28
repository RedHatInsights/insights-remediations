'use strict';

const sinon = require('sinon');
const should = require('should');

const orgAdmin = require('./orgAdmin');
const errors = require('../../errors');

describe('orgAdmin middleware', function () {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    test('allows org admins', () => {
        const req = {
            user: {
                is_org_admin: true
            }
        };
        const next = sandbox.stub();

        orgAdmin(req, {}, next);

        sinon.assert.calledWithExactly(next);
    });

    test('returns forbidden for non-admin users', () => {
        const req = {
            user: {
                is_org_admin: false
            }
        };
        const next = sandbox.stub();

        orgAdmin(req, {}, next);

        sinon.assert.calledOnce(next);
        should(next.firstCall.args[0]).be.instanceOf(errors.Forbidden);
        should(next.firstCall.args[0].error.details.message).eql('Organization admin access required');
    });

    test('returns forbidden when is_org_admin is not set', () => {
        const req = {
            user: {}
        };
        const next = sandbox.stub();

        orgAdmin(req, {}, next);

        sinon.assert.calledOnce(next);
        should(next.firstCall.args[0]).be.instanceOf(errors.Forbidden);
    });
});

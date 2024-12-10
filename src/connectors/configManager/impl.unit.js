'use strict';

const impl = require('./impl');
const base = require('../../test');
const { mockRequest } = require('../testUtils');
const request = require('../../util/request');
const errors = require('../../errors');

const REQ = {
    headers: {
        'x-rh-identity': 'identity',
        'x-rh-insights-request-id': 'request-id'
    },
    identity: { type: 'test' },
    user: { username: 'test', account_number: 'test' }
};

describe('config manager impl', function () {
    beforeEach(mockRequest);

    describe('getCurrentProfile', function () {
        test('get profile', async function () {
            const http = base.getSandbox().stub(request, 'run').resolves({
                statusCode: 200,
                body: {
                    account_id: '654321',
                    active: true,
                    created_at: '2024-02-14T16:05:43.373531Z',
                    creator: 'redhat',
                    name: '6089719-a2789bb0-3702-4d63-97de-a68374d871ad',
                    org_id: '11789772',
                    id: 'c5639a03-4640-4ae3-93ce-9966cae18df7',
                    label: 'b7839a03-4640-4ae3-93ce-9966cae18df8',
                    compliance: true,
                    insights: true,
                    remediations: true
                },
                headers: {}
            });

            const result = await impl.getCurrentProfile(REQ);

            result.should.have.property('id', 'c5639a03-4640-4ae3-93ce-9966cae18df7');
            result.should.have.property('account_id', '654321');
            result.should.have.property('active', true);
            result.should.have.property('created_at', '2024-02-14T16:05:43.373531Z');
            result.should.have.property('creator', 'redhat');
            result.should.have.property('name', '6089719-a2789bb0-3702-4d63-97de-a68374d871ad');
            result.should.have.property('label', 'b7839a03-4640-4ae3-93ce-9966cae18df8');
            result.should.have.property('org_id', '11789772');
            result.should.have.property('compliance', true);
            result.should.have.property('insights', true);
            result.should.have.property('remediations', true);

            http.callCount.should.equal(1);
            const options = http.args[0][0];
            options.headers.should.have.size(2);
            options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
            options.headers.should.have.property('x-rh-identity', 'identity');
        });

        test('connection error handling', async function () {
            base.mockRequestError();
            await expect(impl.getCurrentProfile(REQ)).rejects.toThrow(errors.DependencyError);
        });

        test('status code handling', async function () {
            base.mockRequestStatusCode();
            await expect(impl.getCurrentProfile(REQ)).rejects.toThrow(errors.DependencyError);
        });
    });
});

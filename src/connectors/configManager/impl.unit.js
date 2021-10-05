'use strict';

const impl = require('./impl');
const base = require('../../test');
const { mockRequest } = require('../testUtils');
const request = require('../../util/request');
const errors = require('../../errors');

describe('config manager impl', function () {
    beforeEach(mockRequest);

    describe('getCurrentState', function () {
        test('get state', async function () {
            const http = base.getSandbox().stub(request, 'run').resolves({
                statusCode: 200,
                body: {
                    account: '654321',
                    state: {
                        compliance_openscap: 'enabled',
                        insights: 'enabled',
                        remediations: 'enabled'
                    },
                    id: 'c5639a03-4640-4ae3-93ce-9966cae18df7',
                    label: 'b7839a03-4640-4ae3-93ce-9966cae18df8'
                },
                headers: {}
            });

            const result = await impl.getCurrentState();

            result.should.have.property('id', 'c5639a03-4640-4ae3-93ce-9966cae18df7');
            result.should.have.property('account', '654321');
            result.should.have.property('label', 'b7839a03-4640-4ae3-93ce-9966cae18df8');
            result.state.should.have.property('compliance_openscap', 'enabled');
            result.state.should.have.property('insights', 'enabled');
            result.state.should.have.property('remediations', 'enabled');

            http.callCount.should.equal(1);
            const options = http.args[0][0];
            options.headers.should.have.size(2);
            options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
            options.headers.should.have.property('x-rh-identity', 'identity');
        });

        test('connection error handling', async function () {
            base.mockRequestError();
            await expect(impl.getCurrentState()).rejects.toThrow(errors.DependencyError);
        });

        test('status code handling', async function () {
            base.mockRequestStatusCode();
            await expect(impl.getCurrentState()).rejects.toThrow(errors.DependencyError);
        });
    });
});

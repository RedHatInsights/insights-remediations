'use strict';

const impl = require('./impl');
const base = require('../../test');
const { mockRequest } = require('../testUtils');
const request = require('../../util/request');
const errors = require('../../errors');
const Connector = require('../Connector');

const DISPATCHERWORKREQUEST = [
    {
        recipient: '33a12856-a262-4e1e-b562-c099a735ca76',
        account: 123456,
        url: 'https://cloud.redhat.com/api/remediations/v1/playbook?hosts=33a12856-a262-4e1e-b562-c099a735ca76&localhost',
        labels: {
            'playbook-run': 'ef7a1724-6adc-4370-b88c-bed7cb2d3fd2'
        }
    }, {
        recipient: '74b9182-a262-6d7d-b562-c877a735ca37',
        account: 123456,
        url: 'https://cloud.redhat.com/api/remediations/v1/playbook?hosts=74b9182-a262-6d7d-b562-c877a735ca37&localhost',
        labels: {
            'playbook-run': 'ef7a1724-6adc-4370-b88c-bed7cb2d3fd2'
        }
    }
];

/* eslint-disable max-len */
describe('dispatcher impl', function () {

    beforeEach(mockRequest);

    describe('postPlaybookRunRequests', function () {
        test('post run requests', async function () {
            const http = base.getSandbox().stub(request, 'run').resolves({
                statusCode: 200,
                body: [
                    {
                        code: 200,
                        id: '7ef23cc6-729f-4f65-8ce7-6f8185c051e9'
                    }, {
                        code: 200,
                        id: '5907b393-1448-4867-988b-5eed8fc02846'
                    }
                ],
                headers: {}
            });

            const results = await impl.postPlaybookRunRequests(DISPATCHERWORKREQUEST);
            results.should.have.size(2);

            const result1 = results[0];
            result1.should.have.property('code', 200);
            result1.should.have.property('id', '7ef23cc6-729f-4f65-8ce7-6f8185c051e9');

            const result2 = results[1];
            result2.should.have.property('code', 200);
            result2.should.have.property('id', '5907b393-1448-4867-988b-5eed8fc02846');

            http.callCount.should.equal(1);
            const options = http.args[0][0];
            options.headers.should.have.size(2);
            options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
            options.headers.should.have.property('x-rh-identity', 'identity');
        });

        test('returns null dispatcherWorkRequest is incorrect', async function () {
            base.getSandbox().stub(Connector.prototype, 'doHttp').resolves([]);
            await expect(impl.postPlaybookRunRequests(DISPATCHERWORKREQUEST)).resolves.toBeNull();
        });

        test('connection error handling dispatcherWorkRequest', async function () {
            base.mockRequestError();
            await expect(impl.postPlaybookRunRequests(DISPATCHERWORKREQUEST)).rejects.toThrow(errors.DependencyError);
        });

        test('status code handling dispatcherWorkRequest', async function () {
            base.mockRequestStatusCode();
            await expect(impl.postPlaybookRunRequests(DISPATCHERWORKREQUEST)).rejects.toThrow(errors.DependencyError);
        });
    });
});

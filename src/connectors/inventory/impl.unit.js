'use strict';

const impl = require('./impl');
const base = require('../../test');
const http = require('../http');
const Connector = require('../Connector');
const { mockRequest } = require('../testUtils');

describe('inventory impl', function () {
    beforeEach(mockRequest);

    test('does not make a call for empty list', async function () {
        const spy = base.getSandbox().spy(http, 'request');
        const result = await impl.getSystemDetailsBatch([]);

        result.should.be.empty();
        spy.called.should.be.false();
    });

    test('forwards request headers', async function () {
        const spy = base.getSandbox().stub(Connector.prototype, 'doHttp').resolves({
            results: []
        });

        await impl.getSystemDetailsBatch(['id']);
        const headers = spy.args[0][0].headers;
        headers.should.have.size(2);
        headers.should.have.property('x-rh-identity', 'identity');
        headers.should.have.property('x-rh-insights-request-id', 'request-id');
    });
});

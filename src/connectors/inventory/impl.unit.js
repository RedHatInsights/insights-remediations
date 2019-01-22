'use strict';

const impl = require('./impl');
const base = require('../../test');
const http = require('../http');
const Connector = require('../Connector');

function mockHeaders (headers = {
    'x-rh-identity': 'identity',
    'x-rh-insights-request-id': 'request-id'
}) {
    base.getSandbox().stub(Connector.prototype, 'getForwardedHeaders').returns(headers);
    return headers;
}

describe('inventory impl', function () {

    test('does not make a call for empty list', async function () {
        const spy = base.getSandbox().spy(http, 'request');
        const result = await impl.getSystemDetailsBatch([]);

        result.should.be.empty();
        spy.called.should.be.false();
    });

    test('forwards request headers', async function () {
        const expected = mockHeaders();

        const spy = base.getSandbox().stub(Connector.prototype, 'doHttp').resolves({
            results: []
        });

        await impl.getSystemDetailsBatch(['id']);
        spy.args[0][0].headers.should.eql(expected);
    });
});

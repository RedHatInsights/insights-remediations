'use strict';

const _ = require('lodash');
const URI = require('urijs');
const impl = require('./impl');
const base = require('../../test');
const http = require('../http');
const Connector = require('../Connector');
const { mockRequest, mockCache } = require('../testUtils');
const request = require('../../util/request');
const RequestError = require('request-promise-core/errors').RequestError;

function inventoryResponse (results, total = results.length) {
    return {
        results,
        total
    };
}

describe('inventory impl', function () {
    beforeEach(mockRequest);

    test('placeholder test', () => {});

    test('does not make a call for empty list', async function () {
        const spy = base.getSandbox().spy(http, 'request');
        const result = await impl.getTenantOrgIds([]);

        result.should.be.empty();
        spy.called.should.be.false();
    });
});
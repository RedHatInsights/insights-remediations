'use strict';

const vmaas = require('./vmaas/vmaas');
const base = require('../test');
const http = require('./http');
const StatusCodeError = require('./StatusCodeError');
const errors = require('../errors');

describe('Connector', function () {

    test('wraps errors', async function () {
        base.getSandbox().stub(http, 'request').rejects(new StatusCodeError(500));
        await expect(vmaas.getCve('id')).rejects.toThrowError(errors.DependencyError);
    });
});

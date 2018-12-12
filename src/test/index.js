'use strict';

require('should');
const sinon = require('sinon');
const supertest = require('supertest');
const uuid = require('uuid');

const app = require('../app');
const config = require('../config');
const vmaas = require('../connectors/vmaas');
const identityUtils = require('../middleware/identity/utils');

let server;

beforeAll(async () => {
    server = await app.start();
});

beforeEach(() => {
    exports.sandbox = sinon.createSandbox();
});

exports.getSandbox = () => exports.sandbox;

afterEach(() => {
    exports.sandbox.restore();
    delete exports.sandbox;
});

afterAll(async () => {
    if (server) {
        await server.stop();
    }
});

exports.request = supertest.agent(`http://localhost:${config.port}${config.path.base}`);

function createHeader (id, account_number, internal) {
    return {
        [identityUtils.IDENTITY_HEADER]: identityUtils.createIdentityHeader(String(id), account_number, internal)
    };
}

exports.auth = Object.freeze({
    default: createHeader(),
    emptyInternal: createHeader('test01User', 'test01'),
    emptyCustomer: createHeader('test02User', 'test02', false),
    testWrite: createHeader('testWriteUser', 'testWrite', false)
});

exports.mockVmaas = function () {
    exports.sandbox.stub(vmaas, 'getErratum').callsFake(() => ({ synopsis: 'mock synopsis' }));
};

exports.throw404 = () => {
    const error =  new Error();
    error.name === 'StatusCodeError';
    error.statusCode === 404;
    throw new error;
};

exports.reqId = () => {
    const id = uuid.v4();

    return {
        header: {
            'x-rh-insights-request-id': id
        },
        id
    };
};


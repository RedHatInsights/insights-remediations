'use strict';

require('should');
const sinon = require('sinon');
const supertest = require('supertest');

const app = require('../app');
const config = require('../config');
const vmaas = require('../external/vmaas');

let server;

beforeAll(async () => {
    server = await app.start();
});

beforeEach(() => {
    exports.sandbox = sinon.createSandbox();
});

afterEach(() => {
    exports.sandbox.restore();
    delete exports.sandbox;
});

afterAll(async () => {
    if (server) {
        await server.stop();
    }
});

exports.request = supertest.agent(`http://localhost:${config.port}`);

exports.mockVmaas = function () {
    exports.sandbox.stub(vmaas, 'getErratum').callsFake(() => ({}));
};

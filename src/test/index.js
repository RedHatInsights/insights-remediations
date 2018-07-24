'use strict';

require('should');
const _ = require('lodash');
const sinon = require('sinon');
const supertest = require('supertest');

const app = require('../app');
const config = require('../config');
const vmaas = require('../external/vmaas');

let server;
let sandbox;

beforeAll(async () => {
    sandbox = sinon.createSandbox();
    server = await app.start();
});

afterAll(async () => {
    if (server) {
        await server.stop();
    }

    sandbox.restore();
});

exports.request = supertest.agent(`http://localhost:${config.port}`);

exports.mockVmaas = function () {
    sandbox.stub(vmaas, 'getErrata').callsFake((ids) => (_.keyBy(ids)));
};

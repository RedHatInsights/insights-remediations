'use strict';

require('should');
const supertest = require('supertest');

const app = require('../app');
const config = require('../config');

let server;

beforeAll(async () => {
    server = await app.start();
});

afterAll(async () => {
    if (server) {
        await server.stop();
    }
});

exports.request = supertest.agent(`http://localhost:${config.port}`);

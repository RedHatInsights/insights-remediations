'use strict';

require('./test');
const supertest = require('supertest');
const config = require('./config');

test('healthcheck', () => {
    return supertest.agent(`http://localhost:${config.port}`)
    .get('/health')
    .expect(200);
});

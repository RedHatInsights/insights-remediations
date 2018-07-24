'use strict';

const { request } = require('./test');

test('healthcheck', () => {
    return request
    .get('/health')
    .expect(200);
});

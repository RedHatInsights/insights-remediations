'use strict';

const { request } = require('./test');

test('healthcheck', () => {
    return request
    .get('/v1/health')
    .expect(200);
});

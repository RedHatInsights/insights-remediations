'use strict';

const { request } = require('../test');

test('provides status information', async () => {
    const { body } = await request
    .get('/v1/status')
    .expect(200);

    body.connectors.should.containEql({
        advisor: {
            status: 'ok',
            impl: 'mock'
        },
        compliance: {
            status: 'ok',
            impl: 'mock'
        },
        contentServer: {
            status: 'ok',
            impl: 'mock'
        },
        inventory: {
            status: 'ok',
            impl: 'mock'
        },
        users: {
            status: 'ok',
            impl: 'mock'
        },
        vulnerabilities: {
            status: 'ok',
            impl: 'mock'
        }
    });
});

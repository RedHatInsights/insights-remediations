'use strict';

const { request } = require('../test');

describe('whoami', () => {
    test('returns whoami information', async () => {
        const res = await request
        .get('/v1/whoami')
        .expect(200);
        res.body.should.containEql({
            username: 'tuser@redhat.com',
            account_number: 'test'
        });
    });

    describe('request identifier', () => {
        test('x-rh-insights-request-id header', async () => {
            const {body} = await request
            .get('/v1/whoami')
            .set('x-rh-insights-request-id', 'f5c2ac4fde0d4197adf4734d1def1c2d')
            .expect(200);
            body.should.have.property('request_id', 'f5c2ac4fde0d4197adf4734d1def1c2d');
        });

        test('integer fallback', async () => {
            const {body} = await request
            .get('/v1/whoami')
            .expect(200);
            body.should.have.property('request_id').which.is.a.String();
        });
    });
});

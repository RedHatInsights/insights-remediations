'use strict';

const { request, auth } = require('../test');

describe('config endpoint', () => {
    test('returns exposed configuration values', async () => {
        const res = await request
        .get('/v1/config')
        .expect(200);

        res.body.should.have.property('planRetentionDays');
        res.body.planRetentionDays.should.be.a.Number();
    });

    test('returns planRetentionDays with default value', async () => {
        const res = await request
        .get('/v1/config')
        .expect(200);

        // Default is 270 days (9 months)
        res.body.planRetentionDays.should.equal(270);
    });

    test('accepts cert auth (route is mounted before userIdentity)', async () => {
        const res = await request
            .get('/v1/config')
            .set(auth.cert01)
            .expect(200);

        res.body.should.have.property('planRetentionDays');
        res.body.planRetentionDays.should.be.a.Number();
    });
});

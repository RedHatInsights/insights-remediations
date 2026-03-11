'use strict';

const { request, auth } = require('../test');

describe('config endpoint', () => {
    test('returns exposed configuration values', async () => {
        const res = await request
        .get('/v1/config')
        .expect(200);

        res.body.should.have.property('remediationRetentionDays');
        res.body.remediationRetentionDays.should.be.a.Number();
    });

    test('returns remediationRetentionDays with default value', async () => {
        const res = await request
        .get('/v1/config')
        .expect(200);

        // Default is 270 days (9 months)
        res.body.remediationRetentionDays.should.equal(270);
    });

    test('accepts cert auth (route is mounted before userIdentity)', async () => {
        const res = await request
            .get('/v1/config')
            .set(auth.cert01)
            .expect(200);

        res.body.should.have.property('remediationRetentionDays');
        res.body.remediationRetentionDays.should.be.a.Number();
    });
});

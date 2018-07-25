'use strict';

const { request } = require('../test');

test('returns version and commit information', async () => {
    const res = await request
    .get('/v1/version')
    .expect(200);
    res.body.should.have.keys('version', 'commit');
});

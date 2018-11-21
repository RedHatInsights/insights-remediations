'use strict';

const { request } = require('../test');

test('returns whoami information', async () => {
    const res = await request
    .get('/v1/whoami')
    .expect(200);
    res.body.should.eql({
        id: '100',
        username: 'tuser@redhat.com',
        account_number: 'test'
    });
});

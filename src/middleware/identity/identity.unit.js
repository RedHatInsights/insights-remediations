'use strict';

const { request, auth } = require('../../test');

describe('identity', () => {
    test('fallback', async () => {
        const {body} = await request
        .get('/v1/whoami')
        .expect(200);

        body.should.containEql({
            id: '100',
            username: 'tuser@redhat.com',
            account_number: 'test'
        });
    });

    test('header parsing', async () => {
        const {body} = await request
        .get('/v1/whoami')
        .set(auth.emptyInternal)
        .expect(200);

        body.should.containEql({
            id: '101',
            username: 'tuser@redhat.com',
            account_number: 'test01'
        });
    });

    test('id switcher', async () => {
        const {body} = await request
        .get('/v1/whoami?user_id=500')
        .expect(200);

        body.should.containEql({
            id: '500',
            username: 'tuser@redhat.com',
            account_number: 'test'
        });
    });

    test('account number switcher', async () => {
        const {body} = await request
        .get('/v1/whoami?account_number=foo')
        .set(auth.emptyInternal)
        .expect(200);

        body.should.containEql({
            id: '101',
            username: 'tuser@redhat.com',
            account_number: 'foo'
        });
    });

    test('only internal users can switch accounts', async () => {
        const {body} = await request
        .get('/v1/whoami?account_number=foo&user_id=2')
        .set(auth.emptyCustomer)
        .expect(200);

        body.should.containEql({
            id: '102',
            username: 'tuser@redhat.com',
            account_number: 'test02'
        });
    });
});

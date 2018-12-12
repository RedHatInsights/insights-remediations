'use strict';

const { request, auth } = require('../../test');

describe('identity', () => {
    test('fallback', async () => {
        const {body} = await request
        .get('/v1/whoami')
        .expect(200);

        body.should.containEql({
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
            username: 'test01User',
            account_number: 'test01'
        });
    });

    test('id switcher', async () => {
        const {body} = await request
        .get('/v1/whoami?username=500')
        .expect(200);

        body.should.containEql({
            username: '500',
            account_number: 'test'
        });
    });

    test('account number switcher', async () => {
        const {body} = await request
        .get('/v1/whoami?account_number=foo')
        .set(auth.emptyInternal)
        .expect(200);

        body.should.containEql({
            username: 'test01User',
            account_number: 'foo'
        });
    });

    test('only internal users can switch accounts', async () => {
        const {body} = await request
        .get('/v1/whoami?account_number=foo&username=200')
        .set(auth.emptyCustomer)
        .expect(200);

        body.should.containEql({
            username: 'test02User',
            account_number: 'test02'
        });
    });
});

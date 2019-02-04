'use strict';

const { request, auth } = require('../../test');
const utils = require('./utils');

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

    test('401s on missing account_number', async () => {
        await request
        .get('/v1/whoami')
        .set(utils.IDENTITY_HEADER, utils.createIdentityHeader(undefined, undefined, true, data => {
            delete data.identity.account_number;
            return data;
        }))
        .expect(401);
    });

    test('403s on missing username', async () => {
        await request
        .get('/v1/remediations')
        .set(utils.IDENTITY_HEADER, utils.createIdentityHeader(undefined, undefined, true, data => {
            delete data.identity.user.username;
            return data;
        }))
        .expect(403);
    });

    test('403s on type === system', async () => {
        await request
        .get('/v1/remediations')
        .set(auth.cert01)
        .expect(403);
    });

    test('403s on missing is_internal', async () => {
        await request
        .get('/v1/remediations')
        .set(utils.IDENTITY_HEADER, utils.createIdentityHeader(undefined, undefined, true, data => {
            delete data.identity.user.is_internal;
            return data;
        }))
        .expect(403);
    });

    test('cert auth', async () => {
        const {body} = await request
        .get('/v1/whoami')
        .set(auth.cert01)
        .expect(200);

        body.should.containEql({
            username: null,
            account_number: 'diagnosis01'
        });
    });
});

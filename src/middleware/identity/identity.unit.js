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

    test('header parsing (utf8)', async () => {
        const {body} = await request
        .get('/v1/whoami')
        .set(auth.emptyInternalUtf8)
        .expect(200);

        body.should.containEql({
            username: 'test03User',
            account_number: 'test03'
        });
    });

    test('anemic tenant', async () => {
        const {body} = await request
            .get('/v1/whoami')
            .set(auth.anemicTenant)
            .expect(200);

        body.should.containEql({
            username: 'anemicUser',
            org_id: '9999999'
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
        .get('/v1/whoami?account=foo')
        .set(auth.emptyInternal)
        .expect(200);

        body.should.containEql({
            username: 'test01User',
            account_number: 'foo'
        });
    });

    test('only internal users can switch accounts', async () => {
        const {body} = await request
        .get('/v1/whoami?account=foo&username=200')
        .set(auth.emptyCustomer)
        .expect(200);

        body.should.containEql({
            username: 'test02User',
            account_number: 'test02'
        });
    });

    test('401s on missing account_number AND org_id', async () => {
        await request
        .get('/v1/whoami')
        .set(utils.IDENTITY_HEADER, utils.createIdentityHeader(undefined, undefined, undefined, true, data => {
            delete data.identity.account_number;
            delete data.identity.org_id;
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

    test('403s on null username', async () => {
        await request
        .get('/v1/remediations')
        .set(utils.IDENTITY_HEADER, utils.createIdentityHeader(undefined, undefined, true, data => {
            data.identity.user.username = null;
            return data;
        }))
        .expect(403);
    });

    test('403s on undefined username', async () => {
        await request
        .get('/v1/remediations')
        .set(utils.IDENTITY_HEADER, utils.createIdentityHeader(undefined, undefined, true, data => {
            data.identity.user.username = undefined;
            return data;
        }))
        .expect(403);
    });

    test('403s on empty string username', async () => {
        await request
        .get('/v1/remediations')
        .set(utils.IDENTITY_HEADER, utils.createIdentityHeader(undefined, undefined, true, data => {
            data.identity.user.username = '';
            return data;
        }))
        .expect(403);
    });

    test('403s on whitespace-only username', async () => {
        await request
        .get('/v1/remediations')
        .set(utils.IDENTITY_HEADER, utils.createIdentityHeader(undefined, undefined, true, data => {
            data.identity.user.username = '   ';
            return data;
        }))
        .expect(403);
    });

    test('403s on missing user object', async () => {
        await request
        .get('/v1/remediations')
        .set(utils.IDENTITY_HEADER, utils.createIdentityHeader(undefined, undefined, true, data => {
            delete data.identity.user;
            return data;
        }))
        .expect(403);
    });

    test('403s on null user object', async () => {
        await request
        .get('/v1/remediations')
        .set(utils.IDENTITY_HEADER, utils.createIdentityHeader(undefined, undefined, true, data => {
            data.identity.user = null;
            return data;
        }))
        .expect(403);
    });

    test('allows valid username', async () => {
        const {body} = await request
        .get('/v1/whoami')
        .set(utils.IDENTITY_HEADER, utils.createIdentityHeader('validuser@redhat.com', 'test', '0000000', true))
        .expect(200);

        body.should.containEql({
            username: 'validuser@redhat.com',
            account_number: 'test'
        });
    });

    test('allows username with special characters', async () => {
        const {body} = await request
        .get('/v1/whoami')
        .set(utils.IDENTITY_HEADER, utils.createIdentityHeader('user+test@example.com', 'test', '0000000', true))
        .expect(200);

        body.should.containEql({
            username: 'user+test@example.com',
            account_number: 'test'
        });
    });

    test('allows username with numbers', async () => {
        const {body} = await request
        .get('/v1/whoami')
        .set(utils.IDENTITY_HEADER, utils.createIdentityHeader('user123@redhat.com', 'test', '0000000', true))
        .expect(200);

        body.should.containEql({
            username: 'user123@redhat.com',
            account_number: 'test'
        });
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

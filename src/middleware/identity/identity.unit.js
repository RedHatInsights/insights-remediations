'use strict';

const { request, auth } = require('../../test');
const utils = require('./utils');
const identityMiddleware = require('./impl');
const errors = require('../../errors');

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

describe('satellite X-Forwarded-Identity', () => {
    const FORWARDED_IDENTITY_HEADER = 'x-forwarded-identity';
    const CANONICAL = '49f86dd6-9b43-4db2-8b56-b5637f0b0969';

    function satelliteHeader (mutate) {
        return utils.createCertIdentityHeader('testReadSingle', '4444444', data => {
            data.identity.system.cert_type = 'satellite';
            if (mutate) {
                mutate(data);
            }

            return data;
        });
    }

    function invoke (identityHeader, extraHeaders = {}) {
        const req = {
            id: 'test-req',
            headers: {
                [utils.IDENTITY_HEADER]: identityHeader,
                ...extraHeaders
            }
        };
        const next = jest.fn();
        identityMiddleware(req, {}, next);
        return {req, next, error: next.mock.calls[0][0]};
    }

    test('stores a canonical UUID for satellite cert-auth', () => {
        const {req, next, error} = invoke(satelliteHeader(), {
            [FORWARDED_IDENTITY_HEADER]: `  ${CANONICAL.toUpperCase()}  `
        });

        expect(error).toBeUndefined();
        expect(next).toHaveBeenCalledTimes(1);
        req.forwardedIdentity.should.equal(CANONICAL);
    });

    test('accepts satellite cert-auth when auth_type is only at the top level', () => {
        const header = satelliteHeader(data => {
            data.identity.auth_type = 'cert-auth';
            delete data.identity.internal.auth_type;
        });
        const {req, error} = invoke(header, {
            [FORWARDED_IDENTITY_HEADER]: CANONICAL
        });

        expect(error).toBeUndefined();
        req.forwardedIdentity.should.equal(CANONICAL);
    });

    test('treats a missing header as absent', () => {
        const {req, error} = invoke(satelliteHeader());

        expect(error).toBeUndefined();
        expect(req.forwardedIdentity).toBeUndefined();
    });

    test('treats a whitespace-only header as absent', () => {
        const {req, error} = invoke(satelliteHeader(), {
            [FORWARDED_IDENTITY_HEADER]: '   '
        });

        expect(error).toBeUndefined();
        expect(req.forwardedIdentity).toBeUndefined();
    });

    test('403s on a malformed header for satellite cert-auth', () => {
        const {req, error} = invoke(satelliteHeader(), {
            [FORWARDED_IDENTITY_HEADER]: 'not-a-uuid'
        });

        expect(error).toBeInstanceOf(errors.Forbidden);
        error.error.status.should.equal(403);
        error.error.details.message.should.equal('Invalid X-Forwarded-Identity header');
        expect(req.forwardedIdentity).toBeUndefined();
    });

    test('ignores a malformed header for non-satellite system cert-auth', () => {
        const header = utils.createCertIdentityHeader('diagnosis01', '1234567', data => {
            data.identity.system.cert_type = 'system';
            return data;
        });
        const {req, error} = invoke(header, {
            [FORWARDED_IDENTITY_HEADER]: 'not-a-uuid'
        });

        expect(error).toBeUndefined();
        expect(req.forwardedIdentity).toBeUndefined();
    });

    test('ignores a malformed header for user identities', () => {
        const {req, error} = invoke(utils.createIdentityHeader(), {
            [FORWARDED_IDENTITY_HEADER]: 'not-a-uuid'
        });

        expect(error).toBeUndefined();
        expect(req.forwardedIdentity).toBeUndefined();
    });
});

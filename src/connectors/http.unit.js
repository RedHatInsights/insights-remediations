'use strict';

const P = require('bluebird');
const base = require('../test');
const config = require('../config');
const cache = require('../cache');
const http = require('./http');
const request = require('../util/request');
const StatusCodeError = require('./StatusCodeError');

const MOCK_CACHE = {
    status: 'ready',
    get () {},
    setex () {},
    del () {}
};

describe('connector caching', function () {
    beforeEach(() => {
        base.sandbox.stub(config.redis, 'enabled').value(true);
        base.sandbox.stub(cache, 'get').returns(MOCK_CACHE);
    });

    // wait for a while after each test so that async redis writes still operate on mock cache
    afterEach(async () => await P.delay(50));

    test('serves response directly from cache', async function () {
        const body = 'hello world!';

        base.sandbox.stub(MOCK_CACHE, 'get').resolves(JSON.stringify({
            time: new Date(),
            body
        }));
        base.sandbox.spy(MOCK_CACHE, 'setex');
        base.sandbox.spy(request, 'run');

        const result = await http.request({
            uri: 'https://example.com'
        }, true);

        result.should.equal(body);
        MOCK_CACHE.get.callCount.should.equal(1);
        MOCK_CACHE.setex.callCount.should.equal(0);
        request.run.callCount.should.equal(0);
    });

    test('revalidates stale cache entry (still valid)', async function () {
        const body = 'hello world!';
        const etag = 'foo';

        base.sandbox.stub(MOCK_CACHE, 'get').resolves(JSON.stringify({
            etag,
            time: new Date('2018-01-01'),
            body
        }));
        base.sandbox.stub(request, 'run').resolves({
            statusCode: 304
        });
        base.sandbox.spy(MOCK_CACHE, 'setex');

        const result = await http.request({
            uri: 'https://example.com'
        }, true);

        result.should.equal(body);
        MOCK_CACHE.get.callCount.should.equal(1);
        request.run.callCount.should.equal(1);
        request.run.args[0][0].headers['if-none-match'].should.equal(etag);
        MOCK_CACHE.setex.callCount.should.equal(1);
        MOCK_CACHE.setex.args[0][0].should.equal('remediations|http-cache|https://example.com');
    });

    test('revalidates stale cache entry (new value)', async function () {
        const body = 'new value';
        const etag = 'new etag';

        base.sandbox.stub(MOCK_CACHE, 'get').resolves(JSON.stringify({
            etag: 'old etag',
            time: new Date('2018-01-01'),
            body: 'old value'
        }));
        base.sandbox.stub(request, 'run').resolves({
            statusCode: 200,
            headers: {
                etag
            },
            body
        });
        base.sandbox.spy(MOCK_CACHE, 'setex');

        const result = await http.request({
            uri: 'https://example.com'
        }, true);

        result.should.equal(body);
        MOCK_CACHE.get.callCount.should.equal(1);
        request.run.callCount.should.equal(1);
        request.run.args[0][0].headers['if-none-match'].should.equal('old etag');
        MOCK_CACHE.setex.callCount.should.equal(1);
        MOCK_CACHE.setex.args[0][0].should.equal('remediations|http-cache|https://example.com');
        const cached = JSON.parse(MOCK_CACHE.setex.args[0][2]);
        cached.etag.should.equal(etag);
        cached.body.should.equal(body);
    });

    test('invalidates previously cached entry if revalidation yields 404', async function () {
        base.sandbox.stub(MOCK_CACHE, 'get').resolves(JSON.stringify({
            etag: 'foo',
            time: new Date('2018-01-01'),
            body: 'hello'
        }));
        base.sandbox.stub(request, 'run').resolves({
            statusCode: 404
        });
        base.sandbox.spy(MOCK_CACHE, 'setex');
        base.sandbox.spy(MOCK_CACHE, 'del');

        const result = await http.request({
            uri: 'https://example.com'
        }, true);

        expect(result).toBeNull();
        MOCK_CACHE.get.callCount.should.equal(1);
        request.run.callCount.should.equal(1);
        MOCK_CACHE.setex.callCount.should.equal(0);
        MOCK_CACHE.del.callCount.should.equal(1);
    });

    test('fetches and stores the response if no cached entry available', async function () {
        const body = 'hello world!';

        base.sandbox.stub(MOCK_CACHE, 'get').resolves(null);
        base.sandbox.stub(request, 'run').resolves({
            statusCode: 200,
            headers: {
                etag: 'foo'
            },
            body
        });
        base.sandbox.spy(MOCK_CACHE, 'setex');

        const result = await http.request({
            uri: 'https://example.com'
        }, true);

        result.should.equal(body);
        MOCK_CACHE.get.callCount.should.equal(1);
        request.run.callCount.should.equal(1);
        MOCK_CACHE.setex.callCount.should.equal(1);
        MOCK_CACHE.setex.args[0][0].should.equal('remediations|http-cache|https://example.com');
    });

    test('does not cache 404', async function () {
        base.sandbox.stub(MOCK_CACHE, 'get').resolves(null);
        base.sandbox.stub(request, 'run').resolves({
            statusCode: 404
        });
        base.sandbox.spy(MOCK_CACHE, 'setex');

        const result = await http.request({
            uri: 'https://example.com'
        }, true);

        expect(result).toBeNull();
        MOCK_CACHE.get.callCount.should.equal(1);
        request.run.callCount.should.equal(1);
        MOCK_CACHE.setex.callCount.should.equal(0);
    });

    test('throws error on 500', async function () {
        base.sandbox.stub(MOCK_CACHE, 'get').resolves(null);
        base.sandbox.stub(request, 'run').resolves({
            statusCode: 500
        });
        base.sandbox.stub(MOCK_CACHE, 'setex').resolves(null);

        const expected = expect(http.request({
            uri: 'https://example.com'
        }, true)).rejects;

        await expected.toThrowError(StatusCodeError);
        await expected.toHaveProperty('statusCode', 500);

        MOCK_CACHE.get.callCount.should.equal(1);
        request.run.callCount.should.equal(1);
        MOCK_CACHE.setex.callCount.should.equal(0);
    });

    test('throws error on socket error', async function () {
        base.sandbox.stub(MOCK_CACHE, 'get').resolves(null);
        base.sandbox.stub(request, 'run').rejects(new Error('socket timeout'));
        base.sandbox.stub(MOCK_CACHE, 'setex').resolves(null);

        const expected = expect(http.request({
            uri: 'https://example.com'
        }, true)).rejects;

        await expected.toThrowError('socket timeout');

        MOCK_CACHE.get.callCount.should.equal(1);
        request.run.callCount.should.equal(1);
        MOCK_CACHE.setex.callCount.should.equal(0);
    });

    test('ignores cache if useCache = false', async function () {
        base.sandbox.stub(MOCK_CACHE, 'get').resolves(null);
        base.sandbox.stub(request, 'run').resolves({
            statusCode: 404
        });
        base.sandbox.stub(MOCK_CACHE, 'setex').resolves(null);

        await http.request({
            uri: 'https://example.com'
        });

        MOCK_CACHE.get.callCount.should.equal(0);
        request.run.callCount.should.equal(1);
        MOCK_CACHE.setex.callCount.should.equal(0);
    });
});

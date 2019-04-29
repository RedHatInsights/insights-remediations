'use strict';

const _ = require('lodash');
const request = require('../util/request');
const cache = require('../cache');
const log = require('../util/log');
const { notNil } = require('../util/preconditions');
const config = require('../config');
const StatusCodeError = require('./StatusCodeError');

const CACHE_TTL = config.cache.ttl;
const REVALIDATION_INTERVAL = config.cache.revalidationInterval;

function doHttp (options, cached, metrics) {
    const opts = {
        resolveWithFullResponse: true,
        simple: false,
        ...options
    };

    if (_.get(cached, 'etag.length') > 0) {
        opts.headers = opts.headers || {};
        opts.headers['if-none-match'] = cached.etag;
    }

    const before = new Date();
    return request.run(opts)
    .then(res => {
        metrics && metrics.duration.observe(new Date() - before);
        switch (res.statusCode) {
            case 200:
            case 304: return res;
            case 404: return null;
            default: throw new StatusCodeError(res.statusCode, opts, res.body);
        }
    });
}

function cacheKey (uri) {
    return `remediations|http-cache|${uri}`;
}

async function loadCachedEntry (redis, key, revalidationInterval) {
    let cached = await redis.get(key);

    if (!cached) {
        return;
    }

    cached = JSON.parse(cached);
    cached.time = new Date(cached.time);
    cached.expired = new Date() - cached.time > revalidationInterval * 1000;
    return cached;
}

function saveCachedEntry (redis, key, etag, body) {
    redis.setex(key, CACHE_TTL, JSON.stringify({
        etag,
        time: new Date().toISOString(),
        body
    }));
}

async function run (options, useCache = false, metrics = false, responseTransformer = res => res === null ? null : res.body) {
    if (!useCache || !config.redis.enabled || cache.get().status !== 'ready') {
        metrics && metrics.miss.inc();
        return doHttp(options, false, metrics).then(responseTransformer);
    }

    const uri = notNil(options.uri);
    const key = useCache.key || cacheKey(uri);
    const revalidationInterval = useCache.revalidationInterval || REVALIDATION_INTERVAL; // seconds

    const cached = await loadCachedEntry(cache.get(), key, revalidationInterval);

    if (useCache.refresh) {
        log.trace({key}, 'forced refresh');
    } else if (cached && !cached.expired) {
        log.trace({key}, 'cache hit');
        metrics && metrics.hit.inc();
        return cached.body;
    } else if (cached) {
        log.trace({key, etag: cached.etag}, 'cache hit (needs revalidation)');
    } else {
        log.trace({key}, 'cache miss');
    }

    metrics && metrics.miss.inc();
    const res = await doHttp(options, cached, metrics);

    if (!res) { // 404
        if (cached) {
            cache.get().del(key);
        }

        return null;
    }

    if (res.statusCode === 304) {
        log.trace({key}, 'revalidated');
        saveCachedEntry(cache.get(), key, cached.etag, cached.body);
        return cached.body;
    }

    if (useCache.cacheable && res.body && !useCache.cacheable(res.body)) {
        log.trace({key}, 'not cacheable');
        return res.body;
    }

    log.trace({key}, 'saved to cache');
    saveCachedEntry(cache.get(), key, res.headers.etag, res.body);
    return responseTransformer(res);
}

module.exports.request = run;

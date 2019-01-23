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

function doHttp (options, cached) {
    const opts = {
        resolveWithFullResponse: true,
        simple: false,
        ...options
    };

    if (_.get(cached, 'etag.length') > 0) {
        opts.headers = opts.headers || {};
        opts.headers['if-none-match'] = cached.etag;
    }

    return request.run(opts)
    .then(res => {
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

async function loadCachedEntry (redis, key) {
    let cached = await redis.get(key);

    if (!cached) {
        return;
    }

    cached = JSON.parse(cached);
    cached.time = new Date(cached.time);
    cached.expired = new Date() - cached.time > REVALIDATION_INTERVAL * 1000;
    return cached;
}

function saveCachedEntry (redis, key, etag, body) {
    redis.setex(key, CACHE_TTL, JSON.stringify({
        etag,
        time: new Date().toISOString(),
        body
    }));
}

async function run (options, useCache = false) {
    if (!useCache || !config.redis.enabled || cache.get().status !== 'ready') {
        return doHttp(options).then(res => (res === null ? null : res.body));
    }

    const uri = notNil(options.uri);
    const key = cacheKey(uri);
    const cached = await loadCachedEntry(cache.get(), key);

    if (cached && !cached.expired) {
        log.trace({uri}, 'cache hit');
        module.exports.stats.hits++;
        return cached.body;
    } else if (cached) {
        log.trace({uri, etag: cached.etag}, 'cache hit (needs revalidation)');
        module.exports.stats.hits++;
    } else {
        log.trace({uri}, 'cache miss');
        module.exports.stats.misses++;
    }

    const res = await doHttp(options, cached);

    if (!res) { // 404
        if (cached) {
            cache.get().del(key);
        }

        return null;
    }

    if (res.statusCode === 304) {
        log.trace({uri}, 'revalidated');
        saveCachedEntry(cache.get(), key, cached.etag, cached.body);
        return cached.body;
    }

    log.trace({uri}, 'saved to cache');
    saveCachedEntry(cache.get(), key, res.headers.etag, res.body);
    return res.body;
}

module.exports.request = run;

module.exports.stats = {
    hits: 0,
    misses: 0
};


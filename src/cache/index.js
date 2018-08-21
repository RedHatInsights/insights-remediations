'use strict';

const Redis = require('ioredis');
const config = require('../config');
const log = require('../util/log');
const _ = require('lodash');
const P = require('bluebird');

const QUIT_TIMEOUT = 1000;

let client = null;

exports.connect = function () {
    if (client) {
        return client;
    }

    log.info(`Redis ${config.redis.enabled ? 'enabled' : 'disabled'}`);

    if (!config.redis.enabled) {
        return;
    }

    const opts = {
        //wait 30 seconds before trying to reconnect to prevent log spam
        retryStrategy: () => 30000
    };

    _.merge(opts, config.redis);

    client = new Redis(opts);

    client.on('connect', () => log.info('connected to Redis'));
    client.on('error', err => {
        log.warn({error: err.message}, 'error connecting to redis');
    });

    return client;
};

exports.get = function () {
    if (!client) {
        throw new Error('not connected to Redis');
    }

    return client;
};

exports.close = function () {
    if (client) {
        const local = client;
        client = null;
        return P.resolve(local.quit())
        .timeout(QUIT_TIMEOUT)
        .catch(P.TimeoutError, () => local.disconnect())
        .finally(() => log.info('Redis disconnected'));
    }
};

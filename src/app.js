'use strict';

const http = require('http');
const express = require('express');
const assert = require('assert');
const app = express();
const { createTerminus } = require('@godaddy/terminus');
const log = require('./util/log');
const routes = require('./routes');
const config = require('./config');
const version = require('./util/version');
const redis = require('./cache');
const fn = require('./util/fn');
const db = require('./db');

const P = require('bluebird');

process.on('unhandledRejection', e => {
    log.fatal(e);
    throw e;
});

async function healthCheck() {
    try {
        await db.s.authenticate();
        if (config.redis.enabled) {
            assert(redis.get().status, 'ready');
        }

        return Promise.resolve('Health Check Passes');
    } catch (e) {
        log.error(`Health Check failed due to error: ${e}`);
        return Promise.reject(`Healthcheck Error ${e}`);
    }
}

async function start () {
    log.info({env: config.env}, `${version.full} starting`);
    routes(app);

    const server = P.promisifyAll(http.createServer(app));
    redis.connect();

    async function shutdown () {
        const errors = await fn.runAllSeq(
            redis.close,
            db.close
        );

        errors.forEach(error => log.error(error));
    }

    createTerminus(server, {
        signals: ['SIGINT', 'SIGTERM'],
        healthChecks: {
            '/health': healthCheck
        },

        onSignal () {
            log.info(`${version.full} shutting down`);
            return shutdown();
        },

        onShutdown () {
            log.info(`${version.full} shutdown complete`);
        },

        logger: (msg, error) => log.error(error, msg)
    });

    await db.connect();
    await server.listenAsync(config.port);
    log.info(`${version.full} started`);
    log.info(`PORT: ${config.port}`);

    return {
        stop () {
            return server
            .closeAsync()
            .finally(shutdown);
        }
    };
}

module.exports = { start };

if (require.main === module) {
    start();
}

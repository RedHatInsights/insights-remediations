'use strict';

const http = require('http');
const express = require('express');
const app = express();
const terminus = require('@godaddy/terminus');
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
    // TODO: nothing to check yet
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

        errors.forEach(({message, stack}) => log.error({error: {message, stack}}));
    }

    terminus(server, {
        signals: ['SIGINT', 'SIGTERM'],
        healthChecks: {
            [`${config.path.base}/v1/health`]: healthCheck
        },

        onSignal () {
            log.info(`${version.full} shutting down`);
            return shutdown();
        },

        onShutdown () {
            log.info(`${version.full} shutdown complete`);
        },

        logger: (msg, {message, stack}) => log.error({error: {message, stack}}, msg)
    });

    await db.connect();
    await server.listenAsync(config.port);
    log.info(`${version.full} started`);

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

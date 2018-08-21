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

const P = require('bluebird');

process.on('unhandledRejection', e => {
    log.fatal(e);
    throw e;
});

async function healthCheck() {
    // TODO: nothing to check yet
}

async function start () {
    log.info(`${version.full} starting`);
    routes(app);

    const server = P.promisifyAll(http.createServer(app));
    redis.connect();

    terminus(server, {
        signals: ['SIGINT', 'SIGTERM'],
        healthChecks: {
            '/health': healthCheck
        },

        async onSignal () {
            log.info(`${version.full} shutting down`);
            await redis.close();
        },

        onShutdown () {
            log.info(`${version.full} shutdown complete`);
        },

        logger: (msg, error) => log.error({error}, msg)
    });

    await server.listenAsync(config.port);
    log.info(`${version.full} started`);

    return {
        stop () {
            return server.closeAsync();
        }
    };
}

module.exports = { start };

if (require.main === module) {
    start();
}

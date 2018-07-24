'use strict';

const http = require('http');
const express = require('express');
const app = express();
const terminus = require('@godaddy/terminus');
const log = require('./util/log');
const routes = require('./routes');
const config = require('./config');

const P = require('bluebird');

process.on('unhandledRejection', e => {
    log.fatal(e);
    throw e;
});

async function healthCheck() {
    log.debug('health check');
}

async function start () {
    routes(app);

    const server = P.promisifyAll(http.createServer(app));

    terminus(server, {
        signals: ['SIGINT', 'SIGTERM'],
        healthChecks: {
            '/health': healthCheck
        },

        async onSignal () {
            log.info('server shutting down');
        },

        onShutdown () {
            log.info('server shutdown complete');
        }
    });

    await server.listenAsync(config.port);
    log.info('server started');

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

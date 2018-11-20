'use strict';

const pino = require('pino');
const config = require('../config');
const cls = require('./cls');

const serializers = {
    req: value => {
        const result = pino.stdSerializers.req(value);
        result.identity = value.raw.identity;
        return result;
    }
};

const logger = pino({
    name: 'remediations',
    level: config.logging.level,
    prettyPrint: config.logging.pretty
});

function getLogger () {
    const req = cls.getReq();

    if (!req) {
        return logger; // outside of request, fallback to default logger
    }

    if (!req.logger) {
        req.logger = logger.child({reqId: req.id});
    }

    return req.logger;
}

module.exports = new Proxy (logger, {
    get (target, key, receiver) {
        const logger = getLogger();

        const result = Reflect.get(logger, key, receiver);
        if (typeof result === 'function') {
            return result.bind(logger); // bind so that we do not proxy inner calls
        }

        return result;
    }
});

module.exports.serializers = serializers;

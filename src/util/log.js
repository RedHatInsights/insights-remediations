'use strict';

const _ = require('lodash');
const pino = require('pino');
const config = require('../config');
const cls = require('./cls');

// avoid writting down the entire response buffer
function errorSerializer (e) {
    if (!e) {
        return e;
    }

    const result =  _.omit(pino.stdSerializers.err(e), ['originalResponse']);
    result.options = optionsSerialized(result.options);
    result.cause = errorSerializer(result.cause);

    return result;
}

function optionsSerialized (options) {
    if (!options) {
        return options;
    }

    return _.omit(options, ['ca', 'cert']);
}

function headersSerializer (headers) {
    if (!headers) {
        return headers;
    }

    return _.omit(headers, ['cookie']);
}

const serializers = {
    req: value => {
        const result = pino.stdSerializers.req(value);
        result.identity = value.raw.identity;
        result.headers = headersSerializer(result.headers);
        return result;
    },
    err: errorSerializer,
    cause: errorSerializer,
    options: optionsSerialized
};

const logger = pino({
    name: 'remediations',
    level: config.logging.level,
    prettyPrint: config.logging.pretty ? {
        errorProps: '*'
    } : false
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

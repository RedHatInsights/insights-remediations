'use strict';

const _ = require('lodash');
const pino = require('pino');
const pinoms = require('pino-multi-stream');
const config = require('../config');
const cls = require('./cls');
const pinoCloudWatch = require('pino-cloudwatch');

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

function buildDestination () {
    if (!config.logging.cloudwatch.enabled) {
        return pino.destination(1); // stdout
    }

    return pinoms.multistream([{
        stream: pino.destination(1),
        level: config.logging.level
    }, {
        stream: pinoCloudWatch({ ...config.logging.cloudwatch.options }),
        level: config.logging.cloudwatch.level
    }]);
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
    serializers,
    prettyPrint: config.logging.pretty ? {
        errorProps: '*'
    } : false
}, buildDestination());

if (config.logging.cloudwatch.enabled) {
    logger.info({group: config.logging.cloudwatch.options.group}, 'CloudWatch enabled');
}

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

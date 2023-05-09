'use strict';

const _ = require('lodash');
const pino = require('pino');
const config = require('../config');
const cls = require('./cls');

// avoid writing down the entire response buffer
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

function buildTransport () {
    if (!config.logging.cloudwatch.enabled) {
        return {
            target: 'pino-pretty',
            level: config.logging.level
        };
    }

    return {targets: [
            {
                target: 'pino/file',
                options: { destination: 1}, // stdout
                level: config.logging.level
            },
            {
                target: 'pino-cloudwatch',
                level: config.logging.cloudwatch.level,
                options: { ...config.logging.cloudwatch.options }
            }
        ]};
}

const serializers = {
    req: value => {
        const result = pino.stdSerializers.req(value);
        result.identity = value.raw?.identity;
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
    transport: buildTransport()
});

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

module.exports = getLogger();
module.exports.serializers = serializers;

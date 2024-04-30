'use strict';

const _ = require('lodash');
const pino = require('pino');
const pinoHttp = require('pino-http');
const config = require('../config');
const cls = require('./cls');

const MAX_TRACE_SIZE = 200000; // cloudwatch max = 262144

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

    return _.omit(headers, ['cookie', 'x-3scale-proxy-secret-token']);
}

function buildTransport () {
    let options = {};

    if (config.logging.cloudwatch.enabled) {
        options = {targets: [
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

    else {
        options = {
            target: 'pino-pretty',
            level: config.logging.level
        };
    }

    const transport = pino.transport(options);

    return transport;
}

const serializers = {
    req: value => {
        const result = pino.stdSerializers.req(value); // not 100% sure why we do this,
        // as value is already serialized.  This does seem to strip out a bunch
        // of headers, though...
        result.identity = value.raw?.identity;
        result.headers = headersSerializer(result.headers);
        return result;
    },
    res: value => {
        const req = value.raw.req;

        // handle trace data
        if (req.trace) {
            const elapsed = Date.now() - value.raw[pinoHttp.startTime];

            // log trace data if...
            if (
                req.trace.force ||                         // forced tracing
                elapsed > req.trace.threshold_ms ||        // time limit exceeded
                value.statusCode >= 400                    // an error condition
            ){
                // limit trace message size!  Since the error is most likely to
                // be at the end, drop characters from the front...
                const trace_message = req.trace.toString();

                value.trace = trace_message.slice(-MAX_TRACE_SIZE);

                if (trace_message.length > MAX_TRACE_SIZE) {
                    console.log(`Trace data truncated for request: ${req.id}`);
                    console.log(`(trace message length: ${trace_message.length})`);
                }
            }
        }

        return value;
    },
    err: errorSerializer,
    cause: errorSerializer,
    options: optionsSerialized
};

const logger = pino(
    {
        name: 'remediations',
        level: config.logging.level,
        serializers,
        formatters: {
            log: (log) => {
                return log;
            }
        }
    },
    buildTransport()
);

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

// Export a logger proxy, so we can redirect logging calls to req.logger (a
// child logger that has an additional reqID correlation parameter) if we're
// called in the context of a request.  Otherwise, pass the call onto the default
// logger.
module.exports = new Proxy (logger, {
    get (target, key, receiver) {
        const logger = getLogger();

        const result = Reflect.get(logger, key, receiver);
        if (typeof result === 'function') {
            return result.bind(logger); // bind so that we do not proxy inner calls (??)
        }

        return result;
    }
});

// pino-http won't respect the base-logger's serializers, so it's going to need
// a copy too...
module.exports.serializers = serializers;

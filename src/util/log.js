'use strict';

const _ = require('lodash');
const pino = require('pino');
const pinoHttp = require('pino-http');
const config = require('../config');
const cls = require('./cls');

const MAX_TRACE_SIZE = 200000; // cloudwatch max = 262144
const MAX_BODY_LENGTH = 1000;

// Safely serialize an object with size/depth bounds to prevent memory exhaustion.
// Limits array lengths and object depths before stringification.
function boundedSerialize(obj, maxLength = MAX_BODY_LENGTH, maxDepth = 3, maxArrayLength = 10) {
    let currentLength = 0;

    function limitStructure(value, depth) {
        // Stop if we've already generated enough content
        if (currentLength >= maxLength) {
            return '[output limit reached]';
        }

        // Stop at max depth
        if (depth > maxDepth) {
            return '[max depth]';
        }

        // Handle null/undefined
        if (value === null || value === undefined) {
            return value;
        }

        // Handle primitives (string, number, boolean)
        if (typeof value !== 'object') {
            return value;
        }

        // Handle arrays - limit length
        if (Array.isArray(value)) {
            if (value.length === 0) {
                return [];
            }
            const limited = value.slice(0, maxArrayLength).map(item => limitStructure(item, depth + 1));
            if (value.length > maxArrayLength) {
                limited.push(`[... ${value.length - maxArrayLength} more items]`);
            }
            return limited;
        }

        // Handle objects - recurse on each property
        const limited = {};
        let count = 0;
        const maxProps = 20; // Limit properties per object

        for (const [key, val] of Object.entries(value)) {
            if (count >= maxProps) {
                limited['...'] = `${Object.keys(value).length - maxProps} more properties`;
                break;
            }
            limited[key] = limitStructure(val, depth + 1);
            count++;
        }
        return limited;
    }

    try {
        const limited = limitStructure(obj, 0);
        const str = JSON.stringify(limited);
        currentLength = str.length;

        return str.length > maxLength
            ? str.substring(0, maxLength) + '... (truncated)'
            : str;
    } catch (e) {
        return '[Failed to serialize]';
    }
}

function optionsSerialized (options) {
    if (!options) {
        return options;
    }

    const sanitized = _.omit(options, ['ca', 'cert']);

    // Sanitize headers within options to prevent credential leakage
    if (sanitized.headers) {
        sanitized.headers = headersSerializer(sanitized.headers);
    }

    return sanitized;
}

function headersSerializer (headers) {
    if (!headers) {
        return headers;
    }

    // Redact credential and authentication headers from logs (case-insensitive)
    // Note: x-rh-identity is preserved as it's needed for debugging user/org context
    const sensitiveHeaders = [
        'authorization',
        'x-3scale-proxy-secret-token',
        'cookie',
        'set-cookie',
        'x-api-key',
        'x-rh-apitoken'
    ];

    // Pattern-based detection for headers that look like credentials
    function isSensitiveHeader(key) {
        const lowerKey = key.toLowerCase();

        // Exact matches
        if (sensitiveHeaders.includes(lowerKey)) {
            return true;
        }

        // Preserve x-rh-identity for debugging
        if (lowerKey === 'x-rh-identity') {
            return false;
        }

        // Pattern matches: anything ending in -token, -key, -secret, -password, -auth
        if (lowerKey.match(/-(token|key|secret|password|auth)$/)) {
            return true;
        }

        return false;
    }

    const result = {};
    for (const [key, value] of Object.entries(headers)) {
        if (!isSensitiveHeader(key)) {
            result[key] = value;
        }
    }
    return result;
}

// Extract useful error details while avoiding logging huge response buffers.
// For external service errors, this preserves:
// - Service/connector identification
// - HTTP status codes
// - Request details (URI, method)
// - Truncated response body for debugging
// - Full error chain via recursive cause serialization
function errorSerializer (e) {
    if (!e) {
        return e;
    }

    const serialized = pino.stdSerializers.err(e);
    const result = _.omit(serialized, ['originalResponse']);

    // Preserve HttpError details (includes DependencyError with connector name/impl)
    // If error is a native Error object, serialize it to preserve message/stack
    if (e.error) {
        result.error = e.error instanceof Error ? errorSerializer(e.error) : e.error;
    }

    // Extract useful details from originalResponse without logging the entire buffer
    if (e.originalResponse) {
        const response = e.originalResponse;
        result.response = {
            statusCode: response.statusCode,
            statusMessage: response.statusMessage,
            headers: headersSerializer(response.headers)
        };

        // Include a safe, size-limited version of the response body for debugging
        if (response.body) {
            if (typeof response.body === 'string') {
                result.response.body = response.body.length > MAX_BODY_LENGTH
                    ? response.body.substring(0, MAX_BODY_LENGTH) + '... (truncated)'
                    : response.body;
            } else if (typeof response.body === 'object') {
                // Extract only useful error fields with bounded serialization
                const errorFields = _.pick(response.body, [
                    'error', 'errors', 'message', 'detail', 'details',
                    'code', 'status', 'title', 'type', 'reason'
                ]);
                result.response.body = boundedSerialize(errorFields);
            }
        }
    }

    // Preserve request details from options (URI, method, etc.)
    if (e.options) {
        result.request = {
            uri: e.options.uri,
            method: e.options.method,
            headers: headersSerializer(e.options.headers)
        };
    }

    // Preserve statusCode if it's a StatusCodeError or similar
    if (e.statusCode) {
        result.statusCode = e.statusCode;
    }

    // Preserve error details with bounded serialization to prevent memory exhaustion
    if (e.details) {
        if (typeof e.details === 'string') {
            result.details = e.details.length > MAX_BODY_LENGTH
                ? e.details.substring(0, MAX_BODY_LENGTH) + '... (truncated)'
                : e.details;
        } else if (typeof e.details === 'object') {
            // Serialize with depth/size limits instead of copying directly
            const serialized = boundedSerialize(e.details);
            try {
                result.details = JSON.parse(serialized);
            } catch (err) {
                result.details = serialized;
            }
        } else {
            result.details = e.details;
        }
    }

    result.options = optionsSerialized(e.options);
    result.cause = errorSerializer(e.cause);

    return result;
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
        serializers
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

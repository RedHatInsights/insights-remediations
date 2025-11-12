'use strict';

const _ = require('lodash');
const assert = require('assert');
const http = require('./http');
const errors = require('../errors');
const cls = require('../util/cls');
const log = require('../util/log');
const URI = require('urijs');
const config = require('../config');
const {Forbidden} = require("../errors");
const StatusCodeError = require('./StatusCodeError');

const IDENTITY_HEADER = 'x-rh-identity';
const REQ_ID_HEADER = 'x-rh-insights-request-id';

module.exports = class Connector {

    constructor (module) {
        assert(module, 'module not set');
        const parts = module.filename.replace('.js', '').split('/');
        this.impl = parts[parts.length - 1];
        this.name = parts[parts.length - 2];
    }

    getName () {
        return this.name;
    }

    getImpl () {
        return this.impl;
    }

    buildUri (host, ...segments) {
        const uri = new URI(host);
        uri.path(config.path.prefix);
        segments.forEach(segment => uri.segment(segment));
        return uri;
    }

    async doHttp (options, caching, metrics = false, responseTransformer) {
        try {
            const result = await http.request(options, caching, metrics, responseTransformer);
            return result;
        } catch (e) {
            if (e instanceof Forbidden) {
                throw e;
            }

            // Log request and response details for HTTP 400 errors
            if (e instanceof StatusCodeError && e.statusCode === 400) {
                log.error({
                    request: {
                        uri: options.uri,
                        method: options.method,
                        headers: _.omit(options.headers, ['Authorization']),
                        body: options.body
                    },
                    response: {
                        statusCode: e.statusCode,
                        details: e.details
                    },
                    connector: {
                        name: this.getName(),
                        impl: this.getImpl()
                    }
                }, `HTTP 400 error from ${this.getName()} connector`);
            }

            log.trace(e, 'dependency error');
            metrics && metrics.error.inc();
            throw errors.internal.dependencyError(e, this);
        }
    }

    getForwardedHeaders (identity = true) {
        const req = cls.getReq();
        assert(req, 'request not available in CLS');
        const toPick = [REQ_ID_HEADER];
        if (identity) {
            toPick.push(IDENTITY_HEADER);
        }

        const forwarded = _.pick(req.headers, toPick);

        const name = this.getName();
        if (identity) {
            // eslint-disable-next-line security/detect-object-injection
            assert(forwarded[IDENTITY_HEADER], `identity header not available for outbound ${name} request`);
        }

        // eslint-disable-next-line security/detect-object-injection
        assert(forwarded[REQ_ID_HEADER], `request id header not available for outbound ${name} request`);
        return forwarded;
    }
};

'use strict';

const _ = require('lodash');
const assert = require('assert');
const http = require('./http');
const errors = require('../errors');
const cls = require('../util/cls');
const log = require('../util/log');
const URI = require('urijs');
const config = require('../config');

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

    async doHttp (options, caching, metrics = false) {
        try {
            return await http.request(options, caching, metrics);
        } catch (e) {
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
            assert(forwarded[IDENTITY_HEADER], `identity header not available for outbound ${name} request`);
        }

        assert(forwarded[REQ_ID_HEADER], `request id header not available for outbound ${name} request`);
        return forwarded;
    }
};

'use strict';

const _ = require('lodash');
const assert = require('assert');
const http = require('./http');
const errors = require('../errors');
const cls = require('../util/cls');

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

    async doHttp (options, caching) {
        try {
            return await http.request(options, caching);
        } catch (e) {
            throw errors.internal.dependencyError(e, this);
        }
    }

    getForwardedHeaders () {
        const req = cls.getReq();
        assert(req, 'request not available in CLS');
        const forwarded = _.pick(req.headers, [IDENTITY_HEADER, REQ_ID_HEADER]);

        const name = this.getName();
        assert(forwarded[IDENTITY_HEADER], `identity header not available for outbound ${name} request`);
        assert(forwarded[REQ_ID_HEADER], `request id header not available for outbound ${name} request`);
    }
};

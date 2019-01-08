'use strict';

const _ = require('lodash');
const P = require('bluebird');
const log = require('../util/log');
const http = require('../connectors/http');

const TIMEOUT_CODES = ['ESOCKETTIMEDOUT', 'ETIMEDOUT'];

const CONNECTORS = _([
    'advisor',
    'compliance',
    'contentServer',
    'inventory',
    'ssg',
    'users',
    'vmaas',
    'vulnerabilities'
]).keyBy().mapValues(id => require(`../connectors/${id}`)).value();

exports.status = async function (req, res) {
    const result = await P.props(_.mapValues(CONNECTORS, async connector => {
        try {
            await connector.ping();
            return 'ok';
        } catch (e) {
            log.warn({error: {message: e.message, stack: e.stack, options: e.options, ...e}}, 'ping failed');

            const code = _.get(e, 'cause.error.code');
            if (TIMEOUT_CODES.includes(code)) {
                return 'timeout';
            }

            return 'error';
        }
    }));

    result.httpCache = http.stats;

    res.json(result).end();
};

'use strict';

const _ = require('lodash');
const P = require('bluebird');
const log = require('../util/log');
const errors = require('../errors');

const TIMEOUT_CODES = ['ESOCKETTIMEDOUT', 'ETIMEDOUT'];

const CONNECTORS = _([
    'advisor',
    'cac',
    'compliance',
    'contentServer',
    'inventory',
    'users',
    'vmaas',
    'vulnerabilities'
]).keyBy().mapValues(id => require(`../connectors/${id}`)).value();

async function getStatus (connector) {
    try {
        await connector.ping();
        return 'ok';
    } catch (e) {
        log.warn(e, 'ping failed');

        const code = _.get(e, 'cause.error.code');
        if (TIMEOUT_CODES.includes(code)) {
            return 'timeout';
        }

        return 'error';
    }
}

exports.status = errors.async(async function (req, res) {
    const connectors = await P.props(_.mapValues(CONNECTORS, async connector => {
        const status = await getStatus(connector);

        return {
            status,
            impl: connector.getImpl()
        };
    }));

    res.json({
        connectors
    }).end();
});

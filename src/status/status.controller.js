'use strict';

const _ = require('lodash');
const P = require('bluebird');
const log = require('../util/log');
const errors = require('../errors');
const cache = require('../cache');
const db = require('../db');

const TIMEOUT_CODES = ['ESOCKETTIMEDOUT', 'ETIMEDOUT'];
const OK = 'ok';
const ERROR = 'error';

const CONNECTORS = _([
    'advisor',
    'compliance',
    'contentServer',
    'inventory',
    'ssg',
    'users',
    'vmaas',
    'vulnerabilities'
]).keyBy().mapValues(id => require(`../connectors/${id}`)).value(); // eslint-disable-line security/detect-non-literal-require

async function getConnectorStatus (connector) {
    try {
        await connector.ping();
        return OK;
    } catch (e) {
        log.warn(e, 'ping failed');

        const code = _.get(e, 'cause.error.code');
        if (TIMEOUT_CODES.includes(code)) {
            return 'timeout';
        }

        return ERROR;
    }
}

function getRedis () {
    try {
        if (cache.get().status === 'ready') {
            return OK;
        }
    } catch (e) {} // eslint-disable-line no-empty

    return ERROR;
}

async function getDb () {
    try {
        await db.s.authenticate();
        return OK;
    } catch (e) {
        return ERROR;
    }
}

exports.status = errors.async(async function (req, res) {
    const [connectors, db] = await P.all([
        P.props(_.mapValues(CONNECTORS, async connector => {
            const status = await getConnectorStatus(connector);

            return {
                status,
                impl: connector.getImpl()
            };
        })),
        getDb()
    ]);

    res.json({
        connectors,
        dependencies: {
            db: {
                status: db
            },
            redis: {
                status: getRedis()
            }
        }
    }).end();
});

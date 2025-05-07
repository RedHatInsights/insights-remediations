'use strict';

const _ = require('lodash');
const Sequelize = require('sequelize');
const config = require('../config').db;
const log = require('../util/log');
const fs = require('fs');
const path = require('path');
const client = require('prom-client');
const {prefix} = require('../config').metrics;

exports.Sequelize = Sequelize;

exports.fn = _(['COALESCE', 'COUNT', 'DISTINCT', 'NULLIF', 'SUM', 'MAX'])
.keyBy()
.mapValues(fn => _.partial(Sequelize.fn, fn))
.value();

exports.Op = Sequelize.Op;

const dbQueryHistogram = new client.Histogram({
    name: `${prefix}db_histogram`,
    help: `Histogram for database query times`,
    buckets: [10, 50, 100, 500, 1000, 5000, 10000]
});

function loadModels (sequelize, dir) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const models = fs.readdirSync(dir).reduce((models, current) => {
        const model = require(path.join(dir, current))(sequelize, Sequelize);
        models[model.name] = model;
        return models;
    }, {});

    _.each(models, model => model.associate ? model.associate(models) : null);

    return models;
}

exports.connect = async function () {
    if (config.logging === true) {
        config.logging = (msg, duration) => {
            dbQueryHistogram.observe(duration);
            log.debug({log: 'db', duration}, msg);
        };
    }

    exports.s = new Sequelize(config.database, config.username, config.password, config);
    await exports.s.authenticate();

    const models = loadModels(exports.s, path.join(__dirname, '..', 'remediations', 'models'));
    _.assign(exports, models);

    log.info({ssl: config.ssl || false }, `connected to database '${config.database}'`);
    return exports.s;
};

exports.close = async function () {
    if (exports.s) {
        const sequelize = exports.s;
        exports.s = null;
        await sequelize.close();
        log.info('database disconnected');
    }
};


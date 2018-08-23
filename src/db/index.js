'use strict';

const _ = require('lodash');
const Sequelize = require('sequelize');
const config = require('../config').db;
const log = require('../util/log');
const fs = require('fs');
const path = require('path');

exports.Sequelize = Sequelize;

function loadModels (sequelize, dir) {
    const models = fs.readdirSync(dir).reduce((models, current) => {
        const model = sequelize.import(path.join(dir, current));
        models[model.name] = model;
        return models;
    }, {});

    _.each(models, model => model.associate ? model.associate(models) : null);

    return models;
}

exports.connect = async function () {
    if (config.logging === true) {
        config.logging = msg => log.debug({log: 'db'}, msg);
    }

    exports.s = new Sequelize(config.database, config.username, config.password, config);
    await exports.s.authenticate();

    const models = loadModels(exports.s, path.join(__dirname, '..', 'remediations', 'models'));
    _.assign(exports, models);

    log.info('connected to database');
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


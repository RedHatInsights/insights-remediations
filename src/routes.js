'use strict';

const express = require('express');
const log = require('./util/log');
const pino = require('express-pino-logger')({ logger: log });

const swagger = require('./api/swagger');
const errors = require('./errors');

module.exports = async function (app) {
    app.use(pino);
    await swagger(app);

    const v1 = express.Router();

    [
        'generator',
        'resolutions',
        'version'
    ].forEach(resource => require(`./${resource}/routes`)(v1));

    app.use('/v1', v1);

    app.get('/', (req, res) => res.redirect('/docs'));

    app.use(errors.handler);
};

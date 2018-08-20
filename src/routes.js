'use strict';

const express = require('express');
const log = require('./util/log');
const pino = require('express-pino-logger')({ logger: log });
const prettyJson = require('./util/prettyJson');
const httpContext = require('express-http-context');
const cls = require('./util/cls');

const swagger = require('./api/swagger');
const errors = require('./errors');

module.exports = async function (app) {
    app.use(httpContext.middleware);
    app.use(pino);
    app.use(prettyJson);
    await swagger(app);
    app.use(cls.middleware);

    const v1 = express.Router();

    [
        'diagnosis',
        'generator',
        'resolutions',
        'status',
        'version'
    ].forEach(resource => require(`./${resource}/routes`)(v1));

    app.use('/v1', v1);

    app.get('/', (req, res) => res.redirect('/docs'));

    app.use(errors.handler);
};

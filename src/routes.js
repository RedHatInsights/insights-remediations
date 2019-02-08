'use strict';

const express = require('express');

const log = require('./util/log');
const prettyJson = require('./middleware/prettyJson');
const httpContext = require('express-http-context');
const identity = require('./middleware/identity/impl');
const userIdentity = require('./middleware/identity/userIdentity');
const identitySwitcher = require('./middleware/identity/switcher');
const cls = require('./util/cls');
const config = require('./config');
const metrics = require('./metrics');
const reqId = require('./middleware/reqId');
const bodyParser = require('body-parser');
const docs = require('./docs');

const errors = require('./errors');

const pino = require('express-pino-logger')({
    logger: log,
    serializers: log.serializers,
    genReqId: req => req.headers['x-rh-insights-request-id']
});

module.exports = async function (app) {
    app.use((req, res, next) => {
        log.trace({ req }, 'incoming request');
        next();
    });

    if (config.demo === true) {
        app.use(require('./middleware/identity/demo'));
    }

    if (config.env === 'development' || config.env === 'test') {
        app.use(require('./middleware/identity/fallback'));
    }

    app.use(reqId);
    app.use(pino);
    metrics.start(app);

    docs(app, config.path.base);

    app.use(identity);
    app.use(identitySwitcher);
    app.use(bodyParser.json({
        limit: config.bodyParserLimit
    }));

    app.use(httpContext.middleware);
    app.use(cls.middleware);
    app.use(prettyJson);

    const v1 = express.Router();
    require(`./diagnosis/routes`)(v1);
    require(`./whoami/routes`)(v1);

    // diagnosis and whoami are the only path that accepts cert auth
    v1.use(userIdentity);

    [
        'generator',
        'remediations',
        'resolutions',
        'status',
        'version',
        'whoami'
    ].forEach(resource => require(`./${resource}/routes`)(v1));

    app.use(`${config.path.base}/v1`, v1);

    const toDocs = (req, res) => res.redirect(`${config.path.base}/v1/docs`);
    ['/', config.path.base, `${config.path.base}/v1`].forEach(path => app.get(path, toDocs));

    app.use(errors.handler);
};

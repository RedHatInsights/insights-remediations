'use strict';

const express = require('express');

const log = require('./util/log');
const prettyJson = require('./middleware/prettyJson');
const httpContext = require('express-http-context');
const identity = require('./middleware/identity/impl');
const identitySwitcher = require('./middleware/identity/switcher');
const cls = require('./util/cls');
const config = require('./config');
const metrics = require('./metrics');
const reqId = require('./middleware/reqId');

const swagger = require('./api/swagger');
const errors = require('./errors');

const pino = require('express-pino-logger')({
    logger: log,
    serializers: log.serializers,
    genReqId: req => req.headers['x-rh-insights-request-id']
});

module.exports = async function (app) {
    if (config.demo === true) {
        app.use(require('./middleware/identity/demo'));
    }

    if (config.env === 'development' || config.env === 'test') {
        app.use(require('./middleware/identity/fallback'));
    }

    metrics.start(app);
    require('./status/routes')(app);

    app.use(identity);
    app.use(identitySwitcher);
    app.use(httpContext.middleware);
    app.use(cls.middleware);
    app.use(reqId);
    app.use(pino);
    await swagger(app, config.path.base);
    app.use(prettyJson);

    const v1 = express.Router();

    [
        'diagnosis',
        'generator',
        'remediations',
        'resolutions',
        'status',
        'version',
        'whoami'
    ].forEach(resource => require(`./${resource}/routes`)(v1));

    app.use(`${config.path.base}/v1`, v1);
    app.get('/', (req, res) => res.redirect(`${config.path.base}/v1/docs`));

    // The handler is intentionally defined twice so that schema validation errors during error handling are caught
    app.use(errors.handler);
    app.use(errors.handler);
};

'use strict';

const swaggerUi = require('swagger-ui-express');
const openapi = require('../api/openapi');

module.exports = function (app, prefix) {
    app.get(`${prefix}/v1/openapi.yaml`, (req, res) => res.sendFile(openapi.specPath));
    app.get(`${prefix}/v1/openapi.json`, (req, res) => res.json(openapi.spec));

    app.use(`${prefix}/v1/docs`, swaggerUi.serve, swaggerUi.setup(openapi.spec));
};

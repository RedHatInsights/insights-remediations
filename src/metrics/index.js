'use strict';

const promBundle = require('express-prom-bundle');

const { enabled, prefix } = require('../config').metrics;

exports.start = function (app) {
    if (!enabled) {
        return;
    }

    const metricsMiddleware = promBundle({
        httpDurationMetricName: `${prefix}http_request_duration_seconds`,

        includeUp: false,
        includeMethod: false,
        includePath: false,
        includeStatusCode: false,

        promClient: {
            collectDefaultMetrics: {
                prefix
            }
        }
    });
    app.use(metricsMiddleware);
};

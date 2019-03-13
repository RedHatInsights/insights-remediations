'use strict';

const _ = require('lodash');
const promBundle = require('express-prom-bundle');

const { enabled, prefix } = require('../config').metrics;

// https://www.robustperception.io/existential-issues-with-metrics
function initializeLabels (middleware) {
    const metric = middleware.metrics.remediations_http_request_duration_seconds;
    metric.labels(500).observe(0);
    const label = metric.hashMap['status_code:500'];
    label.count = 0;
    label.bucketValues = _.mapValues(label.bucketValues, () => 0);
}

exports.start = function (app) {
    if (!enabled) {
        return;
    }

    const metricsMiddleware = promBundle({
        httpDurationMetricName: `${prefix}http_request_duration_seconds`,

        includeUp: false,
        includeMethod: false,
        includePath: false,
        includeStatusCode: true,

        promClient: {
            collectDefaultMetrics: {
                prefix
            }
        }
    });

    initializeLabels(metricsMiddleware);

    app.use(metricsMiddleware);
};

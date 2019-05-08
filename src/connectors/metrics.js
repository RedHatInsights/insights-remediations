'use strict';

const _ = require('lodash');
const client = require('prom-client');

const { prefix, summaryMaxAge } = require('../config').metrics;
const labelNames = ['connector', 'method'];

function createCounter (variant) {
    return new client.Counter({
        name: `${prefix}connector_${variant}`,
        help: `${variant} counter for connectors`,
        labelNames
    });
}

function createSummary () {
    return new client.Summary({
        name: `${prefix}connector_summary`,
        help: `summary for connectors`,
        maxAgeSeconds: summaryMaxAge,
        ageBuckets: 10,
        labelNames
    });
}

const prototype = {
    hit: createCounter('hit'),
    miss: createCounter('miss'),
    error: createCounter('error'),
    duration: createSummary()
};

exports.createConnectorMetric = function (name, method = 'default') {
    return _.mapValues(prototype, value => {
        const result = value.labels(name, method);
        if (result.inc) {
            result.inc(0); // https://www.robustperception.io/existential-issues-with-metrics
        }

        return result;
    });
};

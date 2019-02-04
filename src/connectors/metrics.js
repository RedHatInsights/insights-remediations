'use strict';

const _ = require('lodash');
const client = require('prom-client');

const { prefix, summaryMaxAge } = require('../config').metrics;
const labelNames = ['connector'];

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

exports.createConnectorMetric = function (name) {
    return _.mapValues(prototype, value => value.labels(name));
};

'use strict';

const _ = require('lodash');

exports.getSystemDetailsBatch = async function (systems) {
    return Promise.resolve(_(systems).keyBy().mapValues(id => ({
        id,
        hostname: `${id}.example.com`,
        display_name: (id.startsWith('d') ? `${id}-system` : undefined)
    })).value());
};

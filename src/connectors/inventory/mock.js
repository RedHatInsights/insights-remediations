'use strict';

const _ = require('lodash');

exports.getSystemDetailsBatch = async function (systems) {
    return Promise.resolve(_(systems)
    .filter(id => id !== 'non-existent-system')
    .keyBy()
    .mapValues(id => {
        const result = {
            id,
            hostname: (/^[0-8]/.test(id) ? `${id}.example.com` : id),
            display_name: (id.startsWith('9') ? `${id}-system` : null)
        };

        return result;

    }).value());
};

exports.ping = async function () {};

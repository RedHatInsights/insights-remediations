'use strict';

const _ = require('lodash');

exports.NON_EXISTENT_SYSTEM = '1040856f-b772-44c7-83a9-eeeeeeeeeeee';

exports.getSystemDetailsBatch = async function (systems) {
    return Promise.resolve(_(systems)
    .filter(id => id !== exports.NON_EXISTENT_SYSTEM)
    .keyBy()
    .mapValues(id => {
        const result = {
            id,
            hostname: (/^[0-8]/.test(id) ? `${id}.example.com` : id),
            display_name: (id.startsWith('9') ? `${id}-system` : null)
        };

        if (id === 'fc94beb8-21ee-403d-99b1-949ef7adb762') {
            result.hostname = null;
        }

        return result;

    }).value());
};

exports.ping = async function () {};

'use strict';

const _ = require('lodash');
const Connector = require('../Connector');

const NON_EXISTENT_SYSTEM = '1040856f-b772-44c7-83a9-eeeeeeeeeeee';

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    getSystemDetailsBatch (systems) {
        return Promise.resolve(_(systems)
        .filter(id => id !== NON_EXISTENT_SYSTEM)
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
    }

    ping () {}
}();

module.exports.NON_EXISTENT_SYSTEM = NON_EXISTENT_SYSTEM;

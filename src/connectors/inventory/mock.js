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

    getSystemsByInsightsId (id) {
        if (id !== '9a212816-a472-11e8-98d0-529269fb1459') {
            return [];
        }

        return [{
            account: 'diagnosis01',
            id: 'none',
            display_name: null,
            hostname: 'jozef-cert01',
            updated: '2018-12-19T14:59:47.954018Z'
        }, {
            account: 'diagnosis01',
            id: '56099741-6294-411d-a5c6-3d0eac23c52f',
            display_name: null,
            hostname: 'jozef-cert01',
            updated: '2018-12-19T16:59:47.954018Z'
        }, {
            account: 'diagnosis01',
            id: 'none',
            display_name: null,
            hostname: 'jozef-cert01',
            updated: '2018-12-19T15:59:47.954018Z'
        }];
    }

    ping () {}
}();

module.exports.NON_EXISTENT_SYSTEM = NON_EXISTENT_SYSTEM;

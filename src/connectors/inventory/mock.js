'use strict';

const _ = require('lodash');
const Connector = require('../Connector');
const generator = require('./systemGenerator');

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    getSystemDetailsBatch (systems) {
        return Promise.resolve(_(systems)
        .keyBy()
        .mapValues(generator.generateSystem)
        .pickBy()
        .value());
    }

    getSystemInfoBatch (systems) {
        return Promise.resolve(_(systems)
            .keyBy()
            .mapValues(generator.generateSystemInfo)
            .pickBy()
            .value());
    }

    getSystemProfileBatch (systems) {
        return Promise.resolve(_(systems)
        .keyBy()
        .mapValues(generator.generateSystemProfile)
        .pickBy()
        .value());
    }

    getSystemsByInsightsId (id) {
        if (id !== '9a212816-a472-11e8-98d0-529269fb1459') {
            return [];
        }

        return [{
            account: 'diagnosis01',
            tenant_org_id: '1234567',
            id: 'none',
            insights_id: '9a212816-a472-11e8-98d0-529269fb1459',
            display_name: null,
            hostname: 'jozef-cert01',
            updated: '2018-12-19T14:59:47.954018Z'
        }, {
            account: 'diagnosis01',
            tenant_org_id: '1234567',
            id: '56099741-6294-411d-a5c6-3d0eac23c52f',
            insights_id: '9a212816-a472-11e8-98d0-529269fb1459',
            display_name: null,
            hostname: 'jozef-cert01',
            updated: '2018-12-19T16:59:47.954018Z'
        }, {
            account: 'diagnosis01',
            tenant_org_id: '1234567',
            id: 'none',
            insights_id: '9a212816-a472-11e8-98d0-529269fb1459',
            display_name: null,
            hostname: 'jozef-cert01',
            updated: '2018-12-19T15:59:47.954018Z'
        }];
    }

    getSystemsByOwnerId () {
        return [{
            account: 'diagnosis01',
            id: 'none',
            insights_id: '9a212816-a472-11e8-98d0-529269fb1459',
            display_name: null,
            hostname: 'jozef-cert01',
            updated: '2018-12-19T14:59:47.954018Z'
        }, {
            account: 'diagnosis01',
            id: '56099741-6294-411d-a5c6-3d0eac23c52f',
            insights_id: '9a212816-a472-11e8-98d0-529269fb1459',
            display_name: null,
            hostname: 'jozef-cert01',
            updated: '2018-12-19T16:59:47.954018Z'
        }, {
            account: 'diagnosis01',
            id: 'none',
            insights_id: '9a212816-a472-11e8-98d0-529269fb1459',
            display_name: null,
            hostname: 'jozef-cert01',
            updated: '2018-12-19T15:59:47.954018Z'
        }];
    }

    ping () {}
}();

module.exports.NON_EXISTENT_SYSTEM = generator.NON_EXISTENT_SYSTEM;

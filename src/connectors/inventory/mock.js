'use strict';

const _ = require('lodash');
const Connector = require('../Connector');
const generator = require('./systemGenerator');
const errors = require('../../errors');

// Helper to create UNKNOWN_SYSTEM error with notFoundIds (matches http.js behavior)
function createUnknownSystemError(notFoundIds) {
    const err = new errors.BadRequest('UNKNOWN_SYSTEM', `Unknown system identifier "${notFoundIds.join(', ')}"`);
    err.notFoundIds = notFoundIds;
    return err;
}

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    getSystemDetailsBatch (systems, refresh = false, retries = 2, strict = true) {
        // Check for non-existent systems first (new Inventory behavior)
        const notFoundIds = systems.filter(id => generator.generateSystem(id) === null);
        
        if (notFoundIds.length > 0 && strict) {
            return Promise.reject(createUnknownSystemError(notFoundIds));
        }

        // If strict=false, filter out missing systems instead of throwing
        return Promise.resolve(_(systems)
        .keyBy()
        .mapValues(generator.generateSystem)
        .pickBy() // removes null values (non-existent systems)
        .value());
    }

    getSystemInfoBatch (systems) {
        // Check for non-existent systems first (new Inventory behavior)
        const notFoundIds = systems.filter(id => generator.generateSystemInfo(id) === null);
        if (notFoundIds.length > 0) {
            return Promise.reject(createUnknownSystemError(notFoundIds));
        }

        return Promise.resolve(_(systems)
            .keyBy()
            .mapValues(generator.generateSystemInfo)
            .value());
    }

    getSystemProfileBatch (systems) {
        // Check for non-existent systems first (new Inventory behavior)
        const notFoundIds = systems.filter(id => generator.generateSystemProfile(id) === null);
        if (notFoundIds.length > 0) {
            return Promise.reject(createUnknownSystemError(notFoundIds));
        }

        return Promise.resolve(_(systems)
        .keyBy()
        .mapValues(generator.generateSystemProfile)
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

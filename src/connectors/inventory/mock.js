'use strict';

const _ = require('lodash');
const Connector = require('../Connector');

const NON_EXISTENT_SYSTEM = '1040856f-b772-44c7-83a9-eeeeeeeeeeee';

const SYSTEMS = {
    'fc94beb8-21ee-403d-99b1-949ef7adb762': {},
    '1040856f-b772-44c7-83a9-eeeeeeeeee01': {
        hostname: 'foo,bar,example.com'
    },
    '1040856f-b772-44c7-83a9-eeeeeeeeee02': {
        hostname: 'foo.example.com"abc'
    },
    '1040856f-b772-44c7-83a9-eeeeeeeeee03': {
        hostname: 'foo.example.com\nabc'
    },
    '1040856f-b772-44c7-83a9-eeeeeeeeee04': {
        hostname: '  foo.  example.com'
    }
};

const SATELLITES = [
    '722ec903-f4b5-4b1f-9c2f-23fc7b0ba390', // connected
    '409dd231-6297-43a6-a726-5ce56923d624', // disconnected
    '72f44b25-64a7-4ee7-a94e-3beed9393972', // no_receptor
    '01bf542e-6092-485c-ba04-c656d77f988a', // no_source
    null, // no_executor,
    '63142926-46a5-498b-9614-01f2f66fd40b' // connected
];

function generateSystem (id) {
    if (id === NON_EXISTENT_SYSTEM) {
        return null;
    }

    if (SYSTEMS.hasOwnProperty(id)) {
        // eslint-disable-next-line security/detect-object-injection
        return Object.assign({ id, display_name: null, hostname: null, ansible_host: null}, SYSTEMS[id]);
    }

    return {
        id,
        hostname: (/^[0-8]/.test(id) ? `${id}.example.com` : id),
        display_name: (id.startsWith('9') ? `${id}-system` : null),
        ansible_host: ((id.startsWith('9') || id.startsWith('1')) ? `${id}.ansible.example.com` : null)
    };
}

function generateTags (id) {
    if (id === NON_EXISTENT_SYSTEM) {
        return null;
    }

    if (SYSTEMS.hasOwnProperty(id)) {
        // eslint-disable-next-line security/detect-object-injection
        return [];
    }

    const satelliteIndex = parseInt(id[id.length - 1], 16) % SATELLITES.length;

    return [{
        namespace: 'Satellite',
        key: 'instance_id',
        value: _.get(SATELLITES, satelliteIndex)
    }, {
        namespace: 'insights-client',
        key: 'env',
        value: 'test'
    }];
}

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    getSystemDetailsBatch (systems) {
        return Promise.resolve(_(systems)
        .keyBy()
        .mapValues(generateSystem)
        .pickBy()
        .value());
    }

    getSystemsByInsightsId (id) {
        if (id !== '9a212816-a472-11e8-98d0-529269fb1459') {
            return [];
        }

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

    getTagsByIds (systems) {
        return Promise.resolve(_(systems)
        .keyBy()
        .mapValues(generateTags)
        .pickBy()
        .value());
    }

    ping () {}
}();

module.exports.NON_EXISTENT_SYSTEM = NON_EXISTENT_SYSTEM;

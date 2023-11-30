'use strict';

const _ = require("lodash");
const UUID = require("uuid");

const NON_EXISTENT_SYSTEM = '1040856f-b772-44c7-83a9-eeeeeeeeeeee';
const DISCONNECTED_SATELLITE = '409dd231-6297-43a6-a726-5ce56923d624';

const SATELLITES = [
    '722ec903-f4b5-4b1f-9c2f-23fc7b0ba390', // connected
    DISCONNECTED_SATELLITE, // disconnected
    '72f44b25-64a7-4ee7-a94e-3beed9393972', // no_receptor
    '01bf542e-6092-485c-ba04-c656d77f988a', // no_source
    null, // no_executor,
    '63142926-46a5-498b-9614-01f2f66fd40b', // connected
    '893f2788-c7a6-4cc3-89bc-9066ffda695e', // connected (Sat RHC, org_id 2)
    '893f2788-c7a6-4cc3-89bc-9066ffda695e'  // connected (Sat RHC, org_id 6)
];

const SYSTEMS = {
    'fc94beb8-21ee-403d-99b1-949ef7adb762': {},
    '4bb19a8a-0c07-4ee6-a78c-504dab783cc8': {},
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
    },
    // this one mimics 35e9b452-e405-499c-9c6e-120010b7b465 in the context of ansible identity (ansible_host, hostname, id)
    '35f36364-6007-4ecc-9666-c4f8d354be9f': {
        hostname: '35e9b452-e405-499c-9c6e-120010b7b465.example.com',
        facts: [
            {
                namespace: 'satellite',
                facts: {
                    satellite_instance_id: _.get(SATELLITES, parseInt(
                        '35e9b452-e405-499c-9c6e-120010b7b465'['35e9b452-e405-499c-9c6e-120010b7b465'.length - 1],
                        16
                    ) % SATELLITES.length)
                }
            }
        ],
        satelliteManaged: true
    }
};

module.exports.generateSystemProfile = function (id) {
    if (id === NON_EXISTENT_SYSTEM) {
        return null;
    }

    if (id === '750c60ee-b67e-4ccd-8d7f-cb8aed2bdbf4' || id === '35e9b452-e405-499c-9c6e-120010b7b465') {
        return {
            id,
            system_profile: {
                owner_id: '81390ad6-ce49-4c8f-aa64-729d374ee65c',
                rhc_client_id: 'f415fc2d-9700-4e30-9621-6a410ccc92c8',
                is_marketplace: true
            }
        };
    }

    if (id === '0341e468-fbae-416c-b16f-5abb64d99834') {
        return {
            id,
            system_profile: {
                owner_id: '81390ad6-ce49-4c8f-aa64-729d374ee65c',
                rhc_client_id: 'f415fc2d-9700-4e30-9621-6a410ccc92c8',
                is_marketplace: false
            }
        };
    }

    // eslint-disable-next-line security/detect-object-injection
    return {
        id,
        system_profile: {
            owner_id: '81390ad6-ce49-4c8f-aa64-729d374ee65c',
            is_marketplace: false
        }
    };
};

module.exports.generateSystemInfo = function (id) {
    const satelliteIndex = parseInt(id[id.length - 1], 16) % SATELLITES.length;

    if (id === NON_EXISTENT_SYSTEM) {
        return null;
    }

    if (SYSTEMS.hasOwnProperty(id)) {
        // eslint-disable-next-line security/detect-object-injection
        return Object.assign({
                id,
                display_name: null,
                hostname: null,
                ansible_host: null,
                facts: [],  // TODO: remove?
                satelliteId: null,
                satelliteOrgId: null,
                satelliteVersion: null, // TODO: remove?
                rhc_client: null,
                marketplace: false,
                satelliteManaged: false},

            SYSTEMS[id]
        );
    }

    const satellite_instance_id = _.get(SATELLITES, satelliteIndex);

    const result = {
        id,
        hostname: (/^[0-8]/.test(id) ? `${id}.example.com` : id),
        display_name: (id.startsWith('9') ? `${id}-system` : null),
        ansible_host: ((id.startsWith('9') || id.startsWith('1')) ? `${id}.ansible.example.com` : null),
        facts: [ // TODO: remove?
            {
                namespace: 'satellite',
                facts: {
                    satellite_instance_id: satellite_instance_id,
                    organization_id: (satelliteIndex === 7) ? '6' : '2',
                    satellite_version: (satelliteIndex >= 6) ? '6.11.3' : '6.10.7'
                }
            }
        ],
        satelliteId: satellite_instance_id,
        satelliteOrgId: (satelliteIndex === 7) ? '6' : '2',
        satelliteVersion: (satelliteIndex >= 6) ? '6.11.3' : '6.10.7', // TODO: remove?
        rhc_client: satellite_instance_id ? null : 'beefedaf'+id.slice(8),
        marketplace: false,
        satelliteManaged: !!(satellite_instance_id)
    };

    return result;
};

module.exports.generateSystem = function (id) {
    const satelliteIndex = parseInt(id[id.length - 1], 16) % SATELLITES.length;

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
        ansible_host: ((id.startsWith('9') || id.startsWith('1')) ? `${id}.ansible.example.com` : null),
        facts: [
            {
                namespace: 'satellite',
                facts: {
                    satellite_instance_id: _.get(SATELLITES, satelliteIndex),
                    organization_id: (satelliteIndex === 7) ? '6' : '2',
                    satellite_version: (satelliteIndex >= 6) ? '6.11.3' : '6.10.7'
                }
            }
        ]
    };
};

module.exports.NON_EXISTENT_SYSTEM = NON_EXISTENT_SYSTEM;
module.exports.DISCONNECTED_SATELLITE = DISCONNECTED_SATELLITE;
'use strict';

require('should');
const sinon = require('sinon');
const supertest = require('supertest');
const uuid = require('uuid');

const app = require('../app');
const config = require('../config');
const fifi = require('../remediations/fifi');
const vmaas = require('../connectors/vmaas');
const identityUtils = require('../middleware/identity/utils');
const USERS = require('../../src/connectors/users/mock').MOCK_USERS;
const request = require('../util/request');
const RequestError = require('request-promise-core/errors').RequestError;

// because some VMaaS tests take a long time to finish
// eslint-disable-next-line no-process-env
jest.setTimeout(parseInt(process.env.TEST_TIMEOUT) || 20000);

let server;

beforeAll(async () => {
    server = await app.start();
});

beforeEach(() => {
    exports.sandbox = sinon.createSandbox();
});

exports.getSandbox = () => exports.sandbox;

exports.mockDate = () => exports.sandbox.stub(Date.prototype, 'toUTCString').returns('Sat, 29 Dec 2018 08:20:35 GMT');
exports.mockTime = () => exports.sandbox.stub(Date.prototype, 'getTime').returns(1546071635);

afterEach(() => {
    exports.sandbox.restore();
    delete exports.sandbox;
});

afterAll(async () => {
    if (server) {
        await server.stop();
    }
});

exports.request = supertest.agent(`http://localhost:${config.port}${config.path.base}`);
exports.requestLegacy = supertest.agent(`http://localhost:${config.port}/r/insights/platform/remediations`);

function createHeader (id, account_number, tenant_org_id, internal, fn) {
    return {
        [identityUtils.IDENTITY_HEADER]: identityUtils.createIdentityHeader(String(id), account_number, tenant_org_id, internal, fn)
    };
}

exports.auth = Object.freeze({
    default: createHeader(),
    emptyInternal: createHeader('test01User', 'test01', '1111111'),
    emptyCustomer: createHeader('test02User', 'test02', '2222222', false),
    anemicTenant: createHeader('anemicUser', undefined, '9999999', false, id => {
        delete id.identity.account_number;
        return id;
    }),
    testWrite: createHeader(USERS.testWriteUser.username, USERS.testWriteUser.account_number, USERS.testWriteUser.tenant_org_id, false),
    testReadSingle: createHeader(USERS.testReadSingleUser.username, USERS.testReadSingleUser.account_number, USERS.testReadSingleUser.tenant_org_id, false),
    testStatus: createHeader(USERS.testStatus.username, USERS.testStatus.account_number, USERS.testStatus.tenant_org_id, false),
    cert01: {
        [identityUtils.IDENTITY_HEADER]: identityUtils.createCertIdentityHeader('diagnosis01', '1234567')
    },
    cert02: {
        [identityUtils.IDENTITY_HEADER]: identityUtils.createCertIdentityHeader(USERS.testReadSingleUser.account_number, USERS.testReadSingleUser.tenant_org_id)
    },
    jharting: createHeader(null, null, null, () => ({
        entitlements: {
            insights: {
                is_entitled: true
            },
            openshift: {
                is_entitled: true
            },
            smart_management: {
                is_entitled: true
            },
            hybrid_cloud: {
                is_entitled: true
            }
        },
        identity: {
            internal: {
                auth_time: 0,
                auth_type: 'jwt-auth',
                org_id: '5318290'
            },
            account_number: '901578',
            org_id: '5318290',
            user: {
                first_name: 'Jozef',
                is_active: true,
                is_internal: true,
                last_name: 'Hartinger',
                locale: 'en_US',
                is_org_admin: true,
                username: 'someUsername',
                email: 'jharting@redhat.com'
            },
            type: 'User'
        }
    })),
    jhartingCert: {
        [identityUtils.IDENTITY_HEADER]: identityUtils.createCertIdentityHeader('901578')
    },
    emptyInternalUtf8: createHeader('test03User', 'test03', '3333333', false, id => {
        id.identity.user.first_name = 'Řehoř';
        id.identity.user.last_name = 'Samsa';
        return id;
    }),
    fifi: createHeader(USERS.fifi.username, USERS.fifi.account_number, USERS.fifi.tenant_org_id, false)
});

exports.buildRbacResponse = function (accessedPermission) {
    return {
        meta: {
            count: 1,
            limit: 10,
            offset: 0
        },
        links: {
            first: '/api/rbac/v1/access/?application=remediations&limit=10&offset=0',
            next: null,
            previous: null,
            last: '/api/rbac/v1/access/?application=remediations&limit=10&offset=0'
        },
        data: [
            {
                permission: accessedPermission,
                resourceDefinitions: []
            }
        ]
    };
};

exports.mockVmaas = function () {
    exports.sandbox.stub(vmaas, 'getErratum').callsFake(() => ({ synopsis: 'mock synopsis' }));
};

exports.throw404 = () => {
    const error =  new Error();
    error.name === 'StatusCodeError';
    error.statusCode === 404;
    throw new error;
};

exports.reqId = () => {
    const id = uuid.v4();

    return {
        header: {
            'x-rh-insights-request-id': id
        },
        id
    };
};

exports.mockRequestError = function (options = {}, response = {}) {
    exports.sandbox.stub(request, 'run').rejects(new RequestError('RequestError', options, response));
};

exports.mockRequestStatusCode = function (statusCode = 500) {
    exports.sandbox.stub(request, 'run').resolves({ statusCode });
};

exports.normalizePlaybookVersionForSnapshot = function (text) {
    text = text.replace(/^# Version: [0-9a-f]{40}$/mg, '# Version: NORMALIZED_PLACEHOLDER');
    text = text.replace(/^# Version: mock$/mg, '# Version: NORMALIZED_PLACEHOLDER');
    return text;
};

exports.mockUuid = () => exports.sandbox.stub(
    fifi, 'generateUuid').returns('249f142c-2ae3-4c3f-b2ec-c8c588999999'
);

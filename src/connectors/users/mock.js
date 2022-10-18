'use strict';

const _ = require('lodash');
const Connector = require('../Connector');

/* eslint-disable security/detect-object-injection */

const MOCK_USERS = _.keyBy([{
    username: 'tuser@redhat.com',
    account_number: 'test',
    tenant_org_id: '0000000',
    first_name: 'Test',
    last_name: 'User'
}, {
    username: 'demoUser',
    account_number: 'demo',
    tenant_org_id: '2222222',
    first_name: 'Demo',
    last_name: 'User'
}, {
    username: 'testWriteUser',
    account_number: 'testWrite',
    tenant_org_id: '3333333',
    first_name: 'Test',
    last_name: 'Write'
}, {
    username: 'bulkDeleteUser',
    account_number: 'testBulk',
    tenant_org_id: '1234567',
    first_name: 'Bulk',
    last_name: 'Delete'
}, {
    username: 'testReadSingleUser',
    account_number: 'testReadSingle',
    tenant_org_id: '4444444',
    first_name: 'Test',
    last_name: 'Single'
}, {
    username: 'someUsername',
    account_number: '8675309',
    tenant_org_id: '11897521',
    first_name: 'Jozef',
    last_name: 'Hartinger'
}, {
    username: 'testStatus',
    account_number: 'testStatus',
    tenant_org_id: '5555555',
    first_name: 'Test',
    last_name: 'Status'
}, {
    username: 'fifi',
    account_number: 'fifi',
    tenant_org_id: '6666666',
    first_name: 'Fi',
    last_name: 'Fi'
}], 'username');

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    async getUser (id) {
        return MOCK_USERS[id];
    }

    ping () {
        return true;
    }
}();

module.exports.MOCK_USERS = MOCK_USERS;

'use strict';

const _ = require('lodash');
const Connector = require('../Connector');

/* eslint-disable security/detect-object-injection */

const MOCK_USERS = _.keyBy([{
    username: 'tuser@redhat.com',
    account_number: 'test',
    first_name: 'Test',
    last_name: 'User'
}, {
    username: 'demoUser',
    account_number: 'demo',
    first_name: 'Demo',
    last_name: 'User'
}, {
    username: 'testWriteUser',
    account_number: 'testWrite',
    first_name: 'Test',
    last_name: 'Write'
}, {
    username: 'testReadSingleUser',
    account_number: 'testReadSingle',
    first_name: 'Test',
    last_name: 'Single'
}, {
    username: 'someUsername',
    account_number: '8675309',
    first_name: 'Jozef',
    last_name: 'Hartinger'
}, {
    username: 'testStatus',
    account_number: 'testStatus',
    first_name: 'Test',
    last_name: 'Status'
}, {
    username: 'fifi',
    account_number: 'fifi',
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

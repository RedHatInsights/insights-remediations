'use strict';

const _ = require('lodash');
const Connector = require('../Connector');

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
    username: '***REMOVED***',
    account_number: '901578',
    first_name: 'Jozef',
    last_name: 'Hartinger'
}], 'username');

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    getUsers (ids = []) {
        return _(ids)
        .filter(id => id in MOCK_USERS)
        .keyBy()
        .mapValues(id => MOCK_USERS[id])
        .value();
    }

    ping () {
        return true;
    }
}();

module.exports.MOCK_USERS = MOCK_USERS;

'use strict';

const _ = require('lodash');

exports.MOCK_USERS = _.keyBy([{
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

exports.getUsers = async function (ids = []) {
    return _(ids)
    .filter(id => id in exports.MOCK_USERS)
    .keyBy()
    .mapValues(id => exports.MOCK_USERS[id])
    .value();
};

exports.ping = async function () {
    return true;
};

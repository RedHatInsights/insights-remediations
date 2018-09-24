'use strict';

const _ = require('lodash');

const defaults = {
    id: 1,
    org_id: '3340851',
    account_number: '540155',
    username: 'jdoe@acme.com',
    email: 'jdoe@acme.com',
    first_name: 'john',
    last_name: 'doe',
    address_string: '\'john doe\' jdoe@acme.com',
    is_active: true,
    is_org_admin: false,
    is_internal: false,
    locale: 'en_US'
};

module.exports = function (req, res, next) {
    req.authorization = {
        group: 'Operators',
        role: 'OperatorRole',
        group_membership: ['Operators', 'Auditors', 'Support', 'Approvers']
    };

    req.identity = _.defaults({
        id: parseInt(req.query.fakeid) || undefined,
        account_number: req.query.faketenant
    }, defaults);

    next();
};

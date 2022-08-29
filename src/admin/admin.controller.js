'use strict';

const db = require('../db');
const errors = require('../errors');

const WILDCARD = '*';

exports.throw500 = errors.async(async function (req) {
    throw new Error(`intentional server error triggered by ${req.user.username}`);
});

exports.users = errors.async(async function (req, res) {
    const query = {
        attributes: [
            ['created_by', 'username'],
            [db.fn.COUNT('id'), 'playbook_count'],
            'account_number'
        ],
        group: ['created_by', 'account_number'],
        order: ['created_by', 'account_number'],
        where: {
            tenant_org_id: req.user.tenant_org_id
        },
        raw: true
    };

    if (req.user.account_number === WILDCARD) {
        delete query.where;
    }

    const users = await db.remediation.findAll(query);

    res.json(users);
});

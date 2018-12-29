'use strict';

const db = require('../db');

const REMEDIATION_ATTRIBUTES = [
    'id',
    'name',
    'auto_reboot',
    'account_number',
    'created_by',
    'created_at',
    'updated_by',
    'updated_at'
];
const ISSUE_ATTRIBUTES = ['issue_id', 'resolution'];

exports.list = function (account_number, created_by, primaryOrder = 'updated_at', asc = true) {
    return db.remediation.findAll({
        attributes: REMEDIATION_ATTRIBUTES,
        include: [{
            attributes: ISSUE_ATTRIBUTES,
            model: db.issue,
            required: false,
            include: [{
                attributes: ['system_id'],
                association: db.issue.associations.systems,
                required: true
            }]
        }],
        where: {
            account_number, created_by
        },
        order: [
            [primaryOrder, asc ? 'ASC' : 'DESC'],
            ['id', 'ASC']
        ]
    });
};

exports.get = function (id, account_number, created_by) {
    return db.remediation.findOne({
        attributes: REMEDIATION_ATTRIBUTES,
        include: [{
            attributes: ISSUE_ATTRIBUTES,
            model: db.issue,
            include: {
                attributes: ['system_id'],
                association: db.issue.associations.systems,
                required: true
            }
        }],
        where: {
            id, account_number, created_by
        },
        order: [
            ['id'],
            [db.issue, 'issue_id'],
            [db.issue, db.issue.associations.systems, 'system_id']
        ]
    });
};

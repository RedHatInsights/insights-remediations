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

function systemSubquery (system_id) {
    const {s: { dialect, col, literal }, fn: { DISTINCT }, issue, issue_system} = db;
    const generator = dialect.QueryGenerator;

    const query = {
        attributes: [DISTINCT(col('remediation_id'))],
        include: [{
            attributes: [],
            association: issue.associations.systems,
            model: issue_system,
            required: true,
            where: { system_id }
        }]
    };

    issue._validateIncludedElements(query);

    // generate sql and remove trailing ";"
    const sql = generator.selectQuery([[db.issue.tableName, db.issue.name]], query).slice(0, -1);
    return literal(`(${sql})`);
}

exports.list = function (account_number, created_by, system = false, primaryOrder = 'updated_at', asc = true) {
    const query = {
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
            account_number,
            created_by

        },
        order: [
            [primaryOrder, asc ? 'ASC' : 'DESC'],
            ['id', 'ASC']
        ]
    };

    if (system) {
        query.where.id = {
            [db.Op.in]: systemSubquery(system)
        };
    }

    return db.remediation.findAll(query);
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

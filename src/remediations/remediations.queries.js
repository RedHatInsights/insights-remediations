'use strict';

const db = require('../db');
const {NULL_NAME_VALUE} = require('./models/remediation');
const _ = require('lodash');

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

exports.list = function (
    account_number,
    created_by,
    system = false,
    primaryOrder = 'updated_at',
    asc = true,
    filter = false,
    limit,
    offset) {

    const {Op, s: {literal, where, col, cast}, fn: { DISTINCT, COUNT}} = db;

    const query = {
        attributes: [
            'id',
            [cast(COUNT(DISTINCT(col('issues.id'))), 'int'), 'issue_count'],
            [cast(COUNT(DISTINCT(col('issues->systems.system_id'))), 'int'), 'system_count']
        ],
        include: [{
            attributes: [],
            model: db.issue,
            required: false,
            include: [{
                attributes: [],
                association: db.issue.associations.systems,
                required: true
            }]
        }],
        where: {
            account_number,
            created_by
        },
        group: ['remediation.id'],
        order: [
            [col(primaryOrder), asc ? 'ASC' : 'DESC'],
            ['id', 'ASC']
        ],
        subQuery: false,
        limit,
        offset,
        raw: true
    };

    if (system) {
        query.where.id = {
            [Op.in]: systemSubquery(system)
        };
    }

    if (filter) {
        filter = `%${filter}%`;

        query.where[Op.or] = [{
            name: {
                [Op.iLike]: filter
            }
        }, {
            [Op.and]: [
                {
                    name: null
                },
                where(literal(db.s.escape(NULL_NAME_VALUE)), Op.iLike, filter)
            ]
        }];
    }

    return db.remediation.findAndCountAll(query);
};

exports.loadDetails = async function (account_number, created_by, rows) {
    const {Op} = db;

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
            created_by,
            id: {
                [Op.in]: _.map(rows, 'id')
            }
        }
    };

    const results = await db.remediation.findAll(query);
    const byId = _.keyBy(results, 'id');

    return rows.map(row => _.assign(byId[row.id].toJSON(), row));
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

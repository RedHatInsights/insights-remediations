'use strict';

/*eslint-disable max-len*/

const db = require('../db');
const {NULL_NAME_VALUE} = require('./models/remediation');
const _ = require('lodash');

const REMEDIATION_ATTRIBUTES = [
    'id',
    'name',
    'auto_reboot',
    'archived',
    'account_number',
    'created_by',
    'created_at',
    'updated_by',
    'updated_at'
];
const ISSUE_ATTRIBUTES = ['issue_id', 'resolution'];
const PLAYBOOK_RUN_ATTRIBUTES = [
    'id',
    'status',
    'remediation_id',
    'created_by',
    'created_at',
    'updated_at'
];

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

    const {Op, s: {literal, where, col, cast}, fn: { DISTINCT, COUNT, SUM }} = db;

    const query = {
        attributes: [
            'id',
            [cast(COUNT(DISTINCT(col('issues.id'))), 'int'), 'issue_count'],
            [cast(COUNT(DISTINCT(col('issues->systems.system_id'))), 'int'), 'system_count'],
            [cast(SUM(cast(where(col('issues->systems.resolved'), 'true'), 'int')), 'int'), 'resolved_count']
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
    const {Op, s: {literal}} = db;

    const query = {
        attributes: REMEDIATION_ATTRIBUTES,
        include: [{
            attributes: ISSUE_ATTRIBUTES,
            model: db.issue,
            required: false,
            where: literal(
                // exclude issues with 0 systems
                // eslint-disable-next-line max-len
                'EXISTS (SELECT * FROM "remediation_issue_systems" WHERE "remediation_issue_systems"."remediation_issue_id" = "issues"."id")'
            )
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
    const {s: {where, col, cast}, fn: { SUM }} = db;

    return db.remediation.findOne({
        attributes: [
            ...REMEDIATION_ATTRIBUTES,
            [cast(SUM(cast(where(col('issues->systems.resolved'), 'true'), 'int')), 'int'), 'resolved_count']
        ],
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
        group: [
            'remediation.id',
            'issues.id',
            'issues->systems.remediation_issue_id',
            'issues->systems.system_id'
        ],
        order: [
            ['id'],
            [db.issue, 'issue_id'],
            [db.issue, db.issue.associations.systems, 'system_id']
        ]
    });
};

exports.getIssueSystems = function (id, account_number, created_by, issueId) {
    return db.remediation.findOne({
        attributes: ['id'],
        include: [{
            attributes: ['issue_id'],
            model: db.issue,
            include: {
                attributes: ['system_id'],
                association: db.issue.associations.systems,
                required: true
            },
            where: {
                issue_id: issueId
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

exports.getPlaybookRuns = function (id, account_number, created_by, primaryOrder = 'updated_at', asc = false) {
    const {s: {col, cast, where}, fn: {DISTINCT, COUNT, SUM}} = db;

    return db.remediation.findOne({
        attributes: [],
        include: [{
            attributes: PLAYBOOK_RUN_ATTRIBUTES,
            model: db.playbook_runs,
            include: [{
                attributes: [
                    'executor_id',
                    'executor_name',
                    'status',
                    [cast(COUNT(DISTINCT(col('playbook_runs->executors->systems.id'))), 'int'), 'system_count'],
                    [cast(SUM(cast(where(col('"playbook_runs->executors->systems"."status"'), 'pending'), 'int')), 'int'), 'count_pending'],
                    [cast(SUM(cast(where(col('"playbook_runs->executors->systems"."status"'), 'success'), 'int')), 'int'), 'count_success'],
                    [cast(SUM(cast(where(col('"playbook_runs->executors->systems"."status"'), 'running'), 'int')), 'int'), 'count_running'],
                    [cast(SUM(cast(where(col('"playbook_runs->executors->systems"."status"'), 'failure'), 'int')), 'int'), 'count_failure'],
                    [cast(SUM(cast(where(col('"playbook_runs->executors->systems"."status"'), 'canceled'), 'int')), 'int'), 'count_canceled']
                ],
                model: db.playbook_run_executors,
                as: 'executors',
                include: [{
                    attributes: [],
                    model: db.playbook_run_systems,
                    as: 'systems'
                }]
            }]
        }],
        where: {
            id, account_number, created_by
        },
        group: [
            'remediation.id',
            'playbook_runs.id',
            'playbook_runs->executors.id'
        ],
        order: [
            [db.playbook_runs, col(primaryOrder), asc ? 'ASC' : 'DESC']
        ]
    });
};

exports.getRunDetails = function (id, playbook_run_id, account_number, created_by) {
    const {s: {col, cast, where}, fn: {DISTINCT, COUNT, SUM}} = db;

    return db.remediation.findOne({
        attributes: [],
        include: [{
            attributes: PLAYBOOK_RUN_ATTRIBUTES,
            model: db.playbook_runs,
            where: {
                id: playbook_run_id
            },
            include: [{
                attributes: [
                    'executor_id',
                    'executor_name',
                    'status',
                    'updated_at',
                    'playbook',
                    'playbook_run_id',
                    [cast(COUNT(DISTINCT(col('playbook_runs->executors->systems.id'))), 'int'), 'system_count'],
                    [cast(SUM(cast(where(col('"playbook_runs->executors->systems"."status"'), 'pending'), 'int')), 'int'), 'count_pending'],
                    [cast(SUM(cast(where(col('"playbook_runs->executors->systems"."status"'), 'success'), 'int')), 'int'), 'count_success'],
                    [cast(SUM(cast(where(col('"playbook_runs->executors->systems"."status"'), 'running'), 'int')), 'int'), 'count_running'],
                    [cast(SUM(cast(where(col('"playbook_runs->executors->systems"."status"'), 'failure'), 'int')), 'int'), 'count_failure'],
                    [cast(SUM(cast(where(col('"playbook_runs->executors->systems"."status"'), 'canceled'), 'int')), 'int'), 'count_canceled']
                ],
                model: db.playbook_run_executors,
                as: 'executors',
                include: [{
                    attributes: [],
                    model: db.playbook_run_systems,
                    as: 'systems'
                }]
            }]
        }],
        where: {
            id, account_number, created_by
        },
        group: [
            'remediation.id',
            'playbook_runs.id',
            'playbook_runs->executors.id'
        ],
        order: [
            [db.remediation.associations.playbook_runs, db.playbook_runs.associations.executors, 'executor_name', 'ASC']
        ]
    });
};

exports.getRunningExecutors = function (remediation_id, playbook_run_id, account, username) {
    const { Op } = db;
    const query = {
        attributes: [
            'id',
            'executor_id',
            'executor_name',
            'status',
            'updated_at',
            'playbook_run_id',
            'receptor_node_id'
        ],
        include: [{
            attributes: ['id'],
            model: db.playbook_runs,
            include: [{
                attributes: ['id'],
                model: db.remediation,
                where: {
                    id: remediation_id,
                    account_number: account,
                    created_by: username
                }
            }],
            where: {
                id: playbook_run_id
            }
        }],
        where: {
            status: {
                [Op.or]: ['pending', 'acked', 'running']
            }
        },
        order: [
            ['executor_name', 'ASC']
        ]
    };

    return db.playbook_run_executors.findAll(query);
};

// eslint-disable-next-line max-len
exports.getSystems = function (remediation_id, playbook_run_id, executor_id = null, ansible_host = null, primaryOrder = 'system_name', asc = true, limit, offset, account, username) {
    const { s: {col}, Op } = db;
    const query = {
        attributes: [
            'id',
            'system_id',
            'system_name',
            'status',
            'updated_at',
            'playbook_run_executor_id'
        ],
        include: [{
            attributes: ['id'],
            model: db.playbook_run_executors,
            required: true,
            include: [{
                attributes: ['id'],
                model: db.playbook_runs,
                include: [{
                    attributes: ['id'],
                    model: db.remediation,
                    where: {
                        id: remediation_id,
                        account_number: account,
                        created_by: username
                    }
                }],
                where: {
                    id: playbook_run_id
                }
            }]
        }],
        order: [
            [col(primaryOrder), asc ? 'ASC' : 'DESC']
        ],
        limit,
        offset
    };

    if (executor_id) {
        query.include[0].where = {
            executor_id
        };
    }

    if (ansible_host) {
        query.where = {
            system_name: {
                [Op.substring]: ansible_host
            }
        };
    }

    return db.playbook_run_systems.findAndCountAll(query);
};

exports.getSystemDetails = function (id, playbook_run_id, system_id, account_number, created_by) {
    return db.playbook_run_systems.findOne({
        attributes: [
            'id',
            'system_id',
            'system_name',
            'status',
            'updated_at',
            ['playbook_run_executor_id', 'executor_id'],
            'console'
        ],
        include: [{
            attributes: ['id'],
            model: db.playbook_run_executors,
            required: true,
            include: [{
                attributes: ['id'],
                model: db.playbook_runs,
                include: [{
                    attributes: [],
                    model: db.remediation,
                    where: {
                        id, account_number, created_by
                    }
                }],
                where: {
                    id: playbook_run_id
                }
            }]
        }],
        where: {
            system_id
        }
    });
};

exports.insertPlaybookRun = async function (run, executors, systems) {
    await db.s.transaction(async transaction => {
        await db.playbook_runs.create(run, {transaction});
        await db.playbook_run_executors.bulkCreate(executors, {transaction});
        await db.playbook_run_systems.bulkCreate(systems, {transaction});
    });
};

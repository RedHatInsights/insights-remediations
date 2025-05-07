'use strict';

/*eslint-disable max-len*/

const config = require('../config');
const cache = require('../cache');
const db = require('../db');
const {NULL_NAME_VALUE} = require('./models/remediation');
const _ = require('lodash');
const trace = require('../util/trace');
const dispatcher = require('../connectors/dispatcher');

const CACHE_TTL = config.db.cache.ttl;

const REMEDIATION_ATTRIBUTES = [
    'id',
    'name',
    'auto_reboot',
    'archived',
    'account_number',
    'tenant_org_id',
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
const FAILURE = 'failure';
const RUNNING = 'running';
const SUCCESS = 'success';

function systemSubquery (system_id) {
    const {s: { dialect, col, literal }, fn: { DISTINCT }, issue, issue_system} = db;
    const generator = dialect.queryGenerator;

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

function resolvedCountSubquery () {
    const {s: { literal } } = db;

    return literal(
        `(` +
           `SELECT CAST(COUNT(remediation_issues.id) AS INT) ` +
           `FROM remediation_issues ` +
           `WHERE remediation_issues.remediation_id = "remediation"."id" ` +
           `AND EXISTS(` +
              `SELECT * FROM remediation_issue_systems ` +
              `WHERE remediation_issues.id = remediation_issue_systems.remediation_issue_id ` +
              `AND remediation_issue_systems.resolved = true` +
           `)` +
        `)`
    );
}

function findRunStatus(run) {
    if (run.count_failure > 0 || run.count_timeout > 0) {
        return FAILURE;
    } else if (run.count_running > 0 && run.count_timeout === 0 && run.count_failure === 0) {
        return RUNNING;
    } else if (run.count_success > 0 && run.count_timeout === 0) {
        return SUCCESS;
    }
}

async function getremediationStatusCounts() {
    const dispatcherRuns = await dispatcher.fetchPlaybookRuns(
        {filter: {service: 'remediations' }},
        {fields: {data: ['labels', 'status'] }}
    );

    const runStatusById = {};
    for (const run of dispatcherRuns.data) {
        const runId = run.labels?.['playbook-run'];
        if (runId) {
            runStatusById[runId] = run.status;
        }
    }

    const playbookRunsForRemediation = await db.playbook_runs.findAll({
        attributes: ['id', 'remediation_id'],
        where: {
            id: Object.keys(runStatusById)
        },
        raw: true
    });

    const remediationStatusCounts = {};
    for (const {id, remediation_id} of playbookRunsForRemediation) {
        if (!remediationStatusCounts[remediation_id]) {
            remediationStatusCounts[remediation_id] = {
                count_success: 0,
                count_failure: 0,
                count_timeout: 0,
                count_running: 0
            };
        }

        const status = runStatusById[id];
        const counts = remediationStatusCounts[remediation_id];

        if (status === 'success') counts.count_success++;
        else if (status === 'failure') counts.count_failure++;
        else if (status === 'timeout') counts.count_timeout++;
        else if (status === 'running') counts.count_running++;
    }

    return remediationStatusCounts;
}

exports.list = async function (
    tenant_org_id,
    created_by,
    system = false,
    primaryOrder = 'updated_at',
    asc = true,
    filter = false,
    hide_archived,
    limit,
    offset) {

    const {Op, s: { literal, where, col, cast }, fn: { COUNT, DISTINCT, MAX }} = db;
    const isSortByStatus = primaryOrder === 'status';
    const statusOrder = {[FAILURE]: 0, [RUNNING]: 1, [SUCCESS]: 2};

    const query = {
        attributes: [
            'id',
            [cast(COUNT(DISTINCT(col('issues.id'))), 'int'), 'issue_count'],
            [cast(COUNT(DISTINCT(col('issues->systems.system_id'))), 'int'), 'system_count'],
            [resolvedCountSubquery(), 'resolved_count'],
            [MAX(col('playbook_runs.created_at')), 'last_run_at']
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
        },
        {
            model: db.playbook_runs,
            as: 'playbook_runs',
            attributes: [],
            required: false
        }],
        where: {
            tenant_org_id,
            created_by
        },
        group: ['remediation.id'],
        // Sort on any remediation column and also issue_count, system_count, last_run_at and status
        // last_run_at sort option will use the playbook_runs.created_at column in the db
        // This will correctly sort by last_run_at when a playbook hasn't been executed yet so playbook_runs.created_at is NULL
        // Status sorting is handled alongside status filtering to share the logic for computing aggregate playbook run statuses
        order: isSortByStatus ? [] : [
            primaryOrder === 'last_run_at'
                ? [literal(`MAX(playbook_runs.created_at) ${asc ? 'ASC NULLS LAST' : 'DESC NULLS FIRST'}`)]
                : [col(
                    primaryOrder === 'issue_count' ? 'issue_count' :
                    primaryOrder === 'system_count' ? 'system_count' :
                    `remediation.${primaryOrder}`
                ), asc ? 'ASC' : 'DESC'],
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

    if (hide_archived) {
        query.where.archived = {
            [Op.eq]: false
        };
    }

    let remediationStatusCounts = null;

    if (filter) {
        // name filter
        if (filter.name) {
            const filterName = `%${filter.name}%`;

            query.where[Op.or] = [{
                name: {
                    [Op.iLike]: filterName
                }
            }];
        }

        // last_run_after filter
        if (filter.last_run_after) {
            if (filter.last_run_after === 'never') {
                // Filter remediations that have never had a playbook run
                // Looks a little complicated because SQL doesn’t provide a straightforward way to do "no associated rows" filtering
                query.where[Op.and] = [
                    ...(query.where[Op.and] || []),
                    literal(`NOT EXISTS (
                        SELECT 1 FROM playbook_runs
                        WHERE playbook_runs.remediation_id = remediation.id
                    )`)
                ];
            } else {
                query.include.push({
                    attributes: [],
                    model: db.playbook_runs,
                    as: 'playbook_runs',
                    required: true,
                    where: {
                        created_at: {
                            [Op.gt]: new Date(filter.last_run_after)
                        }
                    }
                });
            }
        }

        // status filter or sorting by status
        if (filter.status || isSortByStatus) {
            remediationStatusCounts = await getremediationStatusCounts();

            if (filter.status) {
                // For each remediation, call findRunStatus(counts) to determine the aggregate status
                // Only keep remediations whose aggregate status matches
                const matchingRemediationIds = Object.entries(remediationStatusCounts)
                    .filter(([_, counts]) => findRunStatus(counts) === filter.status)
                    .map(([remediation_id]) => remediation_id);

                query.where.id = {
                    ...(query.where.id || {}),
                    [Op.in]: matchingRemediationIds
                };
            }
        }

        // created_after filter
        if (filter.created_after) {
            query.where["created_at"] = { [Op.gt]: new Date(filter.created_after) };
        }

        // updated_after filter
        if (filter.updated_after) {
            query.where["updated_at"] = { [Op.gt]: new Date(filter.updated_after) };
        }
    }

    const result = await db.remediation.findAndCountAll(query);

    // Sorting by status must happen after the database query to get remediations since aggregate status isn't stored in the database
    if (isSortByStatus) {
        if (!remediationStatusCounts) {
            remediationStatusCounts = await getremediationStatusCounts();
        }

        // Loop through the rows and assign aggregate_status
        for (const remediation of result.rows) {
            const statusCounts = remediationStatusCounts?.[remediation.id] || {
                count_success: 0,
                count_failure: 0,
                count_timeout: 0,
                count_running: 0
            };
            
            // Assign the aggregate status or default to SUCCESS if it's undefined
            remediation.aggregate_status = findRunStatus(statusCounts) || SUCCESS;
        }

        // Sort the rows based on the aggregate status
        result.rows.sort((a, b) => {
            const orderA = statusOrder[a.aggregate_status];
            const orderB = statusOrder[b.aggregate_status];
            return asc ? orderA - orderB : orderB - orderA;
        });
    }

    return result;
};

exports.loadDetails = async function (tenant_org_id, created_by, rows) {
    trace.enter('remediations.queries.loadDetails');
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
            tenant_org_id,
            created_by,
            id: {
                [Op.in]: _.map(rows, 'id')
            }
        }
    };

    const results = await db.remediation.findAll(query);
    const byId = _.keyBy(results, 'id');

    let result = [];

    try {
        result = rows.map(row => _.assign(byId[row.id]?.toJSON(), row));
    }

    // TODO: delete this debug try/catch...
    catch (e) {
        trace.event(`ERROR: results = ${JSON.stringify(results)},\nbyId = ${JSON.stringify(byId)},\nrows = ${JSON.stringify(rows)}`);
        trace.force = true;
    }

    trace.leave();
    return result;
};

exports.getPlanNames = function (tenant_org_id) {
    const query = {
        attributes: [
            'name'
        ],
        where: {
            tenant_org_id: tenant_org_id
        }
    };

    return db.remediation.findAll(query);
};

/*
  Load specified remediation from database

  Returns a Promise for the following JSON:

  {
    name: "remediation 1",
    id: "66eec356-dd06-4c72-a3b6-ef27d1508a02",
    auto_reboot: true,
    archived: true,
    account_number: "test",
    tenant_org_id: "0000000",
    created_by: "tuser@redhat.com",
    created_at: "2018-10-04T08:19:36.641Z",
    updated_by: "tuser@redhat.com",
    updated_at: "2018-10-04T08:19:36.641Z",
    resolved_count: 1,
    issues: [
      {
        issue_id: "advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074",
        resolution: null,
        systems: [
          {
            system_id: "fc94beb8-21ee-403d-99b1-949ef7adb762",
            resolved: true
          }
        ]
      }
    ]
  }
*/
exports.get = async function (id, tenant_org_id, created_by = null, includeResolvedCount = true, useCache = false) {
    // This gets called with a high degree of concurrency during playbook runs with RHC direct systems.
    // Remediation plan changes during a playbook run are undesireable anyway so allow for caching these results
    // to ease the load on the database.

    const query = {
        attributes: [
            ...REMEDIATION_ATTRIBUTES
        ],
        include: [{
            attributes: ISSUE_ATTRIBUTES,
            model: db.issue,
            include: {
                attributes: ['system_id', 'resolved'],
                association: db.issue.associations.systems,
                required: true
            }
        }],
        where: {
            id, tenant_org_id
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
    };

    if (includeResolvedCount) {
        query.attributes.push([resolvedCountSubquery(), 'resolved_count']);
    }

    if (created_by) {
        query.where.created_by = created_by;
    }

    if (useCache && config.redis.enabled && cache.get().status === 'ready') {
        // we were asked to use the cache, check that first
        const key = `remediations|db-cache|remediation|${id}`;
        const redis = cache.get();
        let result = await redis.get(key);

        if (result) {
            result = JSON.parse(result);

            // make sure tenant_org_id and created_by match - Remediation plans are scoped to a particular user.
            // created_by will be null for cert auth "users"
            if (result?.tenant_org_id !== tenant_org_id || (created_by && result?.created_by !== created_by)) {
                result = null;
            }
        }

        else {
            // not found in cache, query db
            result = await db.remediation.findOne(query);

            // add non-null entry to cache
            if (result) {
                result = result.toJSON();
                redis.setex(key, CACHE_TTL, JSON.stringify(result));
            }
        }

        return result;
    }

    else {
        // cache wasn't requested so just query the db...
        const result = await db.remediation.findOne(query);

        // we don't use the DAOs anyway so just return JSON if non-null...
        return result ? result.toJSON() : result;

    }
};

// Fetch issues and systems from the specified remediation plan, with optional sorting and filtering by issue name
exports.getIssues = async function (remediation_plan_id, tenant_org_id, created_by = null, issue_name = null, asc = true) {
    const query = {
        attributes: [...ISSUE_ATTRIBUTES],
        include: [
            {
                attributes: [],
                model: db.remediation,
                where: {
                    created_by,
                    tenant_org_id
                }
            },{
                attributes: ['system_id'],
                model: db.issue_system,
                as: 'systems'
            }
        ],
        where: {
            remediation_id: remediation_plan_id,
        },
        order: [
            ['issue_id', asc ? 'ASC' : 'DESC']
        ]
    };

    if (issue_name) {
        query.where.issue_id = {[db.Op.iLike]: `%${issue_name}%`};
    }

    const result = await db.issue.findAll(query);

    // convert the array of model objects into JSON
    return result.map(i => i.toJSON());
};

exports.getIssueSystems = function (id, tenant_org_id, created_by, issueId) {
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
            id, tenant_org_id, created_by
        },
        order: [
            ['id'],
            [db.issue, 'issue_id'],
            [db.issue, db.issue.associations.systems, 'system_id']
        ]
    });
};

exports.getPlaybookRuns = function (id, tenant_org_id, created_by, primaryOrder = 'updated_at', asc = false) {
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
            id, tenant_org_id, created_by
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

exports.getRunDetails = function (id, playbook_run_id, tenant_org_id, created_by) {
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
            id, tenant_org_id, created_by
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

exports.getRunningExecutors = function (remediation_id, playbook_run_id, tenant_org_id, username) {
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
                    tenant_org_id,
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
exports.getSystems = function (remediation_id, playbook_run_id, executor_id = null, ansible_host = null, tenant_org_id, username) {
    const { Op } = db;
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
                        tenant_org_id,
                        created_by: username
                    }
                }],
                where: {
                    id: playbook_run_id
                }
            }]
        }]
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

    return db.playbook_run_systems.findAll(query);
};

exports.getSystemDetails = function (id, playbook_run_id, system_id, tenant_org_id, created_by) {
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
                        id, tenant_org_id, created_by
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

exports.insertRHCPlaybookRun = async function (run) {
    await db.playbook_runs.create(run);
};

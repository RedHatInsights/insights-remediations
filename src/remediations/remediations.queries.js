'use strict';

/*eslint-disable max-len*/

const config = require('../config');
const cache = require('../cache');
const db = require('../db');
const inventory = require('../connectors/inventory');
const {NULL_NAME_VALUE} = require('./models/remediation');
const _ = require('lodash');
const trace = require('../util/trace');
const dispatcher = require('../connectors/dispatcher');
const fifi2 = require('./fifi_2');

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
const ISSUE_ATTRIBUTES = ['issue_id', 'resolution', 'precedence'];
const PLAYBOOK_RUN_ATTRIBUTES = [
    'id',
    'status',
    'remediation_id',
    'created_by',
    'created_at',
    'updated_at'
];

function aggregateStatusSQL() {
    return `CASE
        WHEN COUNT(*) FILTER (WHERE "playbook_runs->dispatcher_runs"."status" IN ('failure', 'timeout')) > 0 THEN 'failure'
        WHEN COUNT(*) FILTER (WHERE "playbook_runs->dispatcher_runs"."status" = 'running') > 0 THEN 'running'
        WHEN COUNT(*) FILTER (WHERE "playbook_runs->dispatcher_runs"."status" = 'success') > 0 THEN 'success'
        ELSE 'pending'
    END`;
}

// This subquery selects the latest playbook_run per remediation
// We added a composite index on playbook_runs (remediation_id, created_at, id)
// So the database can jump straight to the latest playbook_run for a given remediation_id
// instead of reading through lots of rows and sorting them and picking the first
function mostRecentPlaybookRunSubquery(remediationIdColumn = '"remediation"."id"') {
    return `(
        SELECT "pr2"."id"
        FROM "playbook_runs" "pr2" 
        WHERE "pr2"."remediation_id" = ${remediationIdColumn}
        ORDER BY "pr2"."created_at" DESC, "pr2"."id" DESC
        LIMIT 1
    )`;
}

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

    const {Op, s: {literal, where, col, cast}, fn: { DISTINCT, COUNT, MAX }} = db;

    // Check if we need to sync dispatcher runs to accurately sort/filter by status
    const needsStatusSync = primaryOrder === 'status' || (filter && filter.status);

    const sortOrder = [];

    // set primary sort
    switch (primaryOrder) {
        case 'status':
            sortOrder.push([literal(aggregateStatusSQL()), asc ? 'ASC' : 'DESC']);
            break;

        case 'last_run_at':
            sortOrder.push([literal('MAX(playbook_runs.created_at)'), asc ? 'ASC NULLS LAST' : 'DESC NULLS FIRST']);
            break;

        case 'issue_count':
            sortOrder.push([col('issue_count'), asc ? 'ASC' : 'DESC']);
            break;

        case 'system_count':
            sortOrder.push([col('system_count'), asc ? 'ASC' : 'DESC']);
            break;

        default:
            sortOrder.push([col(`remediation.${primaryOrder}`), asc ? 'ASC' : 'DESC']);
    }

    // add secondary sort by id
    sortOrder.push(['id', 'ASC']);

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
            required: false,
            where: {
                id: {
                    [Op.eq]: literal(mostRecentPlaybookRunSubquery())
                }
            },
            include: [{
                model: db.dispatcher_runs,
                as: 'dispatcher_runs',
                attributes: [],
                required: false
            }]
        }],
        where: created_by ? { tenant_org_id, created_by } : { tenant_org_id },
        group: ['remediation.id'],
        // Sort on any remediation column and also issue_count, system_count, last_run_at and status
        // last_run_at sort option will use the playbook_runs.created_at column in the db
        // This will correctly sort by last_run_at when a playbook hasn't been executed yet so playbook_runs.created_at is NULL
        order: sortOrder,
        subQuery: false,
        limit,
        offset,
        raw: true
    };

    // Only add status to attributes when sorting by status or filtering by status (for performance reasons)
    if (primaryOrder === 'status' || (filter && filter.status)) {
        query.attributes.push([literal(aggregateStatusSQL()), 'status']);
    }

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

        // created_after filter
        if (filter.created_after) {
            query.where["created_at"] = { [Op.gt]: new Date(filter.created_after) };
        }

        // updated_after filter
        if (filter.updated_after) {
            query.where["updated_at"] = { [Op.gt]: new Date(filter.updated_after) };
        }

        // status filter
        if (filter.status) {
            // Filter by calculated aggregate status
            query.having = where(
                literal(aggregateStatusSQL()), 
                { [Op.eq]: filter.status }
            );
        }
    }

    // Sync dispatcher_runs assoicated with most recent playbook runs before sorting or filtering by status
    if (needsStatusSync) {
        const recentRuns = await db.playbook_runs.findAll({
            attributes: ['id'],
            include: [{
                model: db.remediation,
                attributes: [],
                where: created_by ? { tenant_org_id, created_by } : { tenant_org_id },
                required: true
            }],
            where: {
                id: {
                    [Op.eq]: literal(mostRecentPlaybookRunSubquery('"playbook_runs"."remediation_id"'))
                }
            },
            raw: true
        });
        await fifi2.syncDispatcherRunsForPlaybookRuns(recentRuns.map(run => run.id));
    }

    const result = await db.remediation.findAndCountAll(query);

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
        where: (() => {
            const whereClause = {
                tenant_org_id,
                id: {
                    [Op.in]: _.map(rows, 'id')
                }
            };
            if (created_by) {
                whereClause.created_by = created_by;
            }
            return whereClause;
        })()
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
            'id',
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
                required: false
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
            [db.issue, 'precedence', 'ASC NULLS LAST'],
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
                where: (() => {
                    const whereClause = { tenant_org_id };
                    if (created_by) {
                        whereClause.created_by = created_by;
                    }
                    return whereClause;
                })()
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
        where: (() => {
            const whereClause = { id, tenant_org_id };
            if (created_by) {
                whereClause.created_by = created_by;
            }
            return whereClause;
        })(),
        order: [
            ['id'],
            [db.issue, 'issue_id'],
            [db.issue, db.issue.associations.systems, 'system_id']
        ]
    });
};


// Return a paginated, sorted list of distinct systems for a remediation plan
exports.getPlanSystems = async function (
    remediation_plan_id,
    tenant_org_id,
    created_by,
    column = 'display_name',
    asc = true,
    filter = null,
    limit = 50,
    offset = 0
) {
    const { Op, s: { literal, col, cast }, fn: { DISTINCT, COUNT }, issue, issue_system, remediation } = db;

    // Fetch distinct system ids for the plan scoped by tenant/user
    const distinctSystemIds = (await issue_system.findAll({
        attributes: [[DISTINCT(col('issue_system.system_id')), 'system_id']],
        include: [{
            attributes: [],
            model: issue,
            required: true,
            where: { remediation_id: remediation_plan_id },
            include: [{
                attributes: [],
                association: issue.associations.remediation,
                model: remediation,
                required: true,
                where: { tenant_org_id, created_by }
            }]
        }],
        raw: true
    })).map(r => r.system_id);

    // If no systems found for the remediation plan, return empty results
    if (distinctSystemIds.length === 0) {
        return { count: 0, rows: [] };
    }

    const where = { [Op.and]: [{ id: { [Op.in]: distinctSystemIds } }] };

    if (filter && typeof filter === 'object') {
        if (filter.id) {
            where[Op.and].push(
                db.s.where(cast(col('id'), 'text'), { [Op.iLike]: `%${filter.id}%` })
            );
        }
        if (filter.hostname) {
            where[Op.and].push({ hostname: { [Op.iLike]: `%${filter.hostname}%` } });
        }
        if (filter.display_name) {
            where[Op.and].push({ display_name: { [Op.iLike]: `%${filter.display_name}%` } });
        }
    }

    const order = [[column, asc ? 'ASC' : 'DESC']];

    const result = await db.systems.findAndCountAll({
        attributes: ['id', 'hostname', 'display_name'],
        where,
        order,
        limit,
        offset,
        raw: true
    });

    if (result.rows.length > 0) {
        const systemIds = result.rows.map(s => s.id);
        
        // Get issue count for only paginated list of systems
        const issueCounts = await db.issue_system.findAll({
            attributes: [
                'system_id',
                [COUNT('*'), 'count']
            ],
            include: [{
                attributes: [],
                model: db.issue,
                required: true,
                where: { remediation_id: remediation_plan_id }
            }],
            where: { system_id: { [Op.in]: systemIds } },
            group: ['system_id'],
            raw: true
        });
        
        const countsBySystemId = _.keyBy(issueCounts, 'system_id');
        
        // Add issue_count for each system in the paginated list
        result.rows = result.rows.map(row => ({
            ...row,
            issue_count: parseInt(countsBySystemId[row.id]?.count || 0)
        }));
    }

    return result;
};

/**
 * Fetch system details for a list of inventory UUIDs from the systems table.
 * For any systems not found in the local systems table, fetches details from the inventory service
 * and stores them locally. Returns hostname, ansible_hostname, and display_name for each system.
 * 
 * @param {string[]} inventoryIds - Array of inventory/system UUIDs to fetch details for
 * @param {number} [chunkSize=50] - Number of systems to process in each database chunk (default: 50)
 * @returns {Object} Object with inventory UUIDs as keys and system details as values
 * 
 * @example
 * // Basic usage with default chunk size
 * const systemDetails = await getPlanSystemsDetails([
 *   'f6b7a1c2-3d4e-5f6a-7b8c-9d0e1f2a3b4c',
 *   'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d'
 * ]);
 * // Returns: {
 * //   'f6b7a1c2-3d4e-5f6a-7b8c-9d0e1f2a3b4c': { 
 * //     hostname: 'server1.example.com', 
 * //     ansible_hostname: 'ansible1', 
 * //     display_name: 'Server 1'
 * //   },
 * //   'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d': { 
 * //     hostname: 'server2.example.com', 
 * //     ansible_hostname: 'ansible2', 
 * //     display_name: 'Server 2'
 * //   }
 * // }
 * 
 * @example
 * // Custom chunk size for performance tuning
 * const systemDetails = await getPlanSystemsDetails([
 *   'f6b7a1c2-3d4e-5f6a-7b8c-9d0e1f2a3b4c'
 * ], 25);
 * 
 * @example
 * // Handling systems not found in inventory (fallback to UUID as hostname)
 * const systemDetails = await getPlanSystemsDetails([
 *   'f6b7a1c2-3d4e-5f6a-7b8c-9d0e1f2a3b4c',
 *   '00000000-0000-0000-0000-000000000000'
 * ]);
 * // Returns: {
 * //   'f6b7a1c2-3d4e-5f6a-7b8c-9d0e1f2a3b4c': { 
 * //     hostname: 'server1.example.com', 
 * //     ansible_hostname: 'ansible1', 
 * //     display_name: 'Server 1'
 * //   },
 * //   '00000000-0000-0000-0000-000000000000': { 
 * //     hostname: '00000000-0000-0000-0000-000000000000', 
 * //     ansible_hostname: null, 
 * //     display_name: null
 * //   }
 * // }
 */
exports.getPlanSystemsDetails = async function (inventoryIds, chunkSize = 50) {
    if (!inventoryIds || inventoryIds.length === 0) {
        return {};
    }

    const result = {};

    // Process in configurable chunks
    const chunks = _.chunk(inventoryIds, chunkSize);

    for (const chunk of chunks) {
        const systems = await db.systems.findAll({
            attributes: ['id', 'hostname', 'ansible_hostname', 'display_name'],
            where: {
                id: chunk
            },
            raw: true
        });

        // Add systems to result object
        systems.forEach(system => {
            result[system.id] = {
                hostname: system.hostname,
                ansible_hostname: system.ansible_hostname,
                display_name: system.display_name
            };
        });
    }

    // For any systems we still couldn't find details for, set default values
    inventoryIds.forEach(inventoryId => {
        if (!result[inventoryId]) {
            result[inventoryId] = {
                hostname: null,
                ansible_hostname: null,
                display_name: null
            };
        }
    });

    return result;
};

// Returns all playbook runs for a remediation
// combineRuns will populate executors from playbook-dispatcher API
exports.getPlaybookRuns = function (id, tenant_org_id, created_by, primaryOrder = 'updated_at', asc = false) {
    const {s: {col}} = db;

    return db.remediation.findOne({
        attributes: [],
        include: [{
            attributes: PLAYBOOK_RUN_ATTRIBUTES,
            model: db.playbook_runs
        }],
        where: {
            id, tenant_org_id, created_by
        },
        order: [
            [db.playbook_runs, col(primaryOrder), asc ? 'ASC' : 'DESC']
        ]
    });
};

exports.getLatestPlaybookRun = async function (id, tenant_org_id, created_by) {
    // Get the latest playbook run ID
    const latestRun = await db.playbook_runs.findOne({
        attributes: ['id'],
        where: {
            remediation_id: id,
            created_by: created_by
        },
        order: [['created_at', 'DESC']]
    });

    if (!latestRun) {
        return null;
    }

    // Get the full details using getRunDetails
    return exports.getRunDetails(id, latestRun.id, tenant_org_id, created_by);
};

// Returns details for the given playbook_run_id
// combineRuns will populate executors from playbook-dispatcher API
exports.getRunDetails = function (id, playbook_run_id, tenant_org_id, created_by) {
    return db.remediation.findOne({
        attributes: [],
        include: [{
            attributes: PLAYBOOK_RUN_ATTRIBUTES,
            model: db.playbook_runs,
            where: {
                id: playbook_run_id
            }
        }],
        where: {
            id, tenant_org_id, created_by
        }
    });
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

// Return issues for a specific system within a remediation plan
exports.getSystemIssues = async function (remediation_id, system_id, tenant_org_id, created_by = null, primaryOrder = 'id', asc = true, filter = undefined, limit, offset) {
    const { Op, issue, remediation, issue_system, s: { col } } = db;

    const include = [
        {
            attributes: [],
            model: remediation,
            required: true,
            where: (() => {
                const whereClause = { id: remediation_id, tenant_org_id };
                if (created_by) {
                    whereClause.created_by = created_by;
                }
                return whereClause;
            })()
        },
        {
            attributes: ['system_id'],
            model: issue_system,
            as: 'systems',
            required: true,
            where: { system_id }
        }
    ];

    const where = {};
    const order = [];

    order.push(['issue_id', asc ? 'ASC' : 'DESC']);

    if (filter) {
        if (filter.id) {
            where.issue_id = { [Op.iLike]: `%${filter.id}%` };
        }

        if (filter['resolution.id']) {
            where.resolution = filter['resolution.id'];
        }
    }

    const query = {
        attributes: ['issue_id', 'resolution'],
        include,
        where,
        order,
        limit,
        offset,
        distinct: true
    };

    return issue.findAndCountAll(query);
};

exports.insertRHCPlaybookRun = async function (run) {
    await db.playbook_runs.create(run);
};

exports.insertDispatcherRuns = async function (runs) {
    if (runs.length === 0) {
        return [];
    }

    // Use ignoreDuplicates to handle race conditions with remediations-consumer
    // which may also create dispatcher_runs entries from Kafka messages
    await db.dispatcher_runs.bulkCreate(runs, { 
        ignoreDuplicates: true 
    });

    return runs;
};

exports.updateDispatcherRuns = async function (dispatcherRunId, remediationsRunId, updates) {
    return db.dispatcher_runs.update(
        updates,
        {
            where: {
                dispatcher_run_id: dispatcherRunId,
                remediations_run_id: remediationsRunId
            }
        }
    );
};

exports.getPlaybookRunsWithDispatcherCounts = async function (playbookRunIds) {
    return db.playbook_runs.findAll({
        where: {
            id: playbookRunIds
        },
        attributes: [
            'id',
            [
                db.s.cast(db.s.fn('COUNT', db.s.col('dispatcher_runs.dispatcher_run_id')), 'INTEGER'),
                'total_dispatcher_runs'
            ],
            [
                db.s.cast(
                    db.s.fn('COUNT', 
                        db.s.literal("CASE WHEN dispatcher_runs.status IN ('failure', 'timeout') THEN 1 END")
                    ),
                    'INTEGER'
                ),
                'failed_runs'
            ],
            [
                db.s.cast(
                    db.s.fn('COUNT', 
                        db.s.literal("CASE WHEN dispatcher_runs.status IN ('pending', 'running') THEN 1 END")
                    ),
                    'INTEGER'
                ),
                'incomplete_runs'
            ]
        ],
        include: [{
            model: db.dispatcher_runs,
            as: 'dispatcher_runs', // Use the alias defined in the association
            required: false, // LEFT JOIN
            attributes: [] // Don't include dispatcher_runs columns in result
        }],
        group: ['playbook_runs.id'],
        raw: true
    });
};

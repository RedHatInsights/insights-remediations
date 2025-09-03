'use strict';

const uuid = require('uuid');
const _ = require('lodash');
const P = require('bluebird');

const config = require('../config');
const errors = require('../errors');
const issues = require('../issues');
const db = require('../db');
const format = require('./remediations.format');
const inventory = require('../connectors/inventory');
const identifiers = require('../util/identifiers');
const disambiguator = require('../resolutions/disambiguator');

const notFound = res => res.status(404).json();

async function validateResolution (id, resolutionId) {
    const identifier = identifiers.parse(id);
    const resolutions = await issues.getHandler(identifier).getResolutionResolver().resolveResolutions(identifier);
    disambiguator.disambiguate(resolutions, resolutionId, identifier);
}

/**
 * Store system details from Host Based Inventory (HBI) response into local systems table
 * 
 * systemsById - Object where keys are system UUIDs and values are system detail objects
 * Example:
 * systemsById = {
 *   "9615dda7-5868-4957-88ba-c3064c86d332": {
 *     id: "9615dda7-5868-4957-88ba-c3064c86d332",
 *     hostname: "packer-rhel7",           // mapped from API's 'fqdn' field
 *     display_name: "web-server-01",      // can be null
 *     ansible_host: "10.0.2.15",         // can be null
 *     facts: [                            // array of fact objects
 *       {
 *         namespace: "rhc", 
 *         facts: { rhc_client_id: "550e8400-e29b-41d4-a716-446655440000" }
 *       }
 *     ]
 *   }
 * }
 */
async function storeSystemDetails(systemsById) {
    // Extract system details from HBI response and store in local systems table
    const remediationSystems = Object.values(systemsById).map(system => ({
        id: system.id,
        hostname: system.hostname || null,
        display_name: system.display_name || null,
        ansible_hostname: system.ansible_host || null
    }));

    if (remediationSystems.length > 0) {
        await db.systems.bulkCreate(remediationSystems, {
            ignoreDuplicates: true
        });
    }
}

async function processNewActions(add) {
    // normalize and validate
    add.issues.forEach(issue => {
        if (!issue.systems && add.systems) {
            issue.systems = [...add.systems];
        }

        if (!issue.systems || !issue.systems.length) {
            throw new errors.BadRequest('NO_SYSTEMS', `Systems not specified for "${issue.id}"`);
        }
    });

    const duplicateIssues = _(add.issues).groupBy('id').pickBy(value => value.length > 1).value();
    if (_.size(duplicateIssues)) {
        throw new errors.BadRequest('DUPLICATE_ISSUE',
            `Issue "${Object.keys(duplicateIssues)[0]}" specified more than once in the issue list`);
    }

    const systems = _(add.issues).flatMap('systems').uniq().value();

    const [systemsById] = await P.all([
        inventory.getSystemDetailsBatch(systems),
        P.all(add.issues.map(issue => validateResolution(issue.id, issue.resolution)))
    ]);

    // verify systems identifiers are valid
    systems.forEach(system => {
        if (!systemsById.hasOwnProperty(system)) {
            throw errors.unknownSystem(system);
        }
    });

    return systemsById;
}

async function storeNewActions (remediation, add, transaction) {
    // need to diff against existing issues as postgresql does not have ON CONFLICT UPDATE implemented yet
    const existingIssuesById = _.keyBy(remediation.issues, 'issue_id');
    const toCreate = add.issues.filter(issue => !existingIssuesById[issue.id]);
    const toUpdate = add.issues.filter(issue => {
        const existing = existingIssuesById[issue.id];
        // if the incoming issue has a different resolution selected than the existing one do update
        return existing && issue.resolution && issue.resolution !== existing.resolution;
    });

    await P.all(toUpdate.map(issue => db.issue.update({
        resolution: issue.resolution
    }, {
        where: {
            remediation_id: remediation.id,
            issue_id: issue.id
        },
        transaction
    })));

    const newIssues = await db.issue.bulkCreate(toCreate.map(issue => ({
        remediation_id: remediation.id,
        issue_id: issue.id,
        resolution: issue.resolution
    })), {
        transaction,
        returning: true
    });

    const issuesById = {
        ..._.keyBy(newIssues, 'issue_id'),
        ...existingIssuesById
    };

    await db.issue_system.bulkCreate(_.flatMap(add.issues, issue => {
        const id = issuesById[issue.id].id;

        return issue.systems.map(system => ({
            remediation_issue_id: id,
            system_id: system
        }));
    }), {
        transaction,
        ignoreDuplicates: true,
        returning: true
    });
}

exports.create = errors.async(async function (req, res) {
    const {add, name, auto_reboot} = req.body;

    let systemsById = null;
    if (add) {
        systemsById = await processNewActions(add);
        await storeSystemDetails(systemsById);
    }

    const id = uuid.v4();

    const result = await db.s.transaction(async transaction => {
        const remediation = await db.remediation.create({
            id,
            name,
            auto_reboot,
            tenant_org_id: req.user.tenant_org_id,
            account_number: req.user.account_number,
            created_by: req.user.username,
            updated_by: req.user.username
        }, {transaction});

        if (add) {
            await storeNewActions(remediation, add, transaction);
        }

        return remediation;
    });

    res.status(201)
    .set('Location', `${config.path.base}/v1/remediations/${id}`)
    .json(format.created(result));
});

exports.patch = errors.async(async function (req, res) {
    const id = req.params.id;
    const {tenant_org_id, username} = req.user;
    const {add, name, auto_reboot, archived} = req.body;

    if (_.isUndefined(add) && _.isUndefined(name) && _.isUndefined(auto_reboot) && _.isUndefined(archived)) {
        // eslint-disable-next-line max-len
        throw new errors.BadRequest('EMPTY_REQUEST', 'At least one of "add", "name", "auto_reboot", "archived" needs to be specified');
    }

    let systemsById = null;
    if (add) {
        systemsById = await processNewActions(add);
        await storeSystemDetails(systemsById);
    }

    const result = await db.s.transaction(async transaction => {
        const remediation = await db.remediation.findOne({
            attributes: ['id'],
            where: { id, tenant_org_id, created_by: username },
            include: {
                attributes: ['id', 'issue_id', 'resolution'],
                model: db.issue
            }
        }, {
            transaction
        });

        if (!remediation) {
            return notFound(res);
        }

        if (add) {
            await storeNewActions(remediation, add, transaction);
        }

        if (name) {
            remediation.name = name;
        }

        if (auto_reboot !== undefined) {
            remediation.auto_reboot = auto_reboot;
        }

        if (archived !== undefined) {
            remediation.archived = archived;
        }

        remediation.updated_by = username;
        await remediation.save({transaction});

        return true;
    });

    result && res.status(200).end();
});

exports.patchIssue = errors.async(async function (req, res) {
    const iid = req.params.issue;
    const { resolution: rid } = req.body;

    // validate that the given resolution exists
    await validateResolution(iid, rid);

    const result = await db.s.transaction(async transaction => {
        const issue = await db.issue.findOne(findIssueQuery(req), {transaction});

        if (!issue) {
            return notFound(res);
        }

        issue.resolution = rid;
        await issue.save({transaction});
        await remediationUpdated(req, transaction);
        return true;
    });

    if (result) {
        return res.status(200).end();
    }
});

function findIssueQuery (req) {
    const id = req.params.id;
    const iid = req.params.issue;
    const {tenant_org_id, username: created_by} = req.user;

    return {
        where: {
            issue_id: iid,
            remediation_id: id
        },
        include: {
            model: db.remediation,
            required: true,
            where: {
                id, tenant_org_id, created_by
            }
        }
    };
}

function remediationUpdated (req, transaction) {
    const {account_number, username} = req.user;

    return db.remediation.update({
        updated_by: username
    }, {
        where: {account_number, created_by: username, id: req.params.id},
        transaction
    });
}

function findAndDestroy (req, entity, query, res) {
    return db.s.transaction(async transaction => {
        const result = await entity.findOne(query, {transaction});

        if (result) {
            await result.destroy({transaction});
            if (entity !== db.remediation) {
                await remediationUpdated(req, transaction);
            }

            return true;
        }
    }).then(result => {
        if (result) {
            return res.status(204).end();
        }

        return notFound(res);
    });
}

function findAllAndDestroy (req, entity, query, res) {
    return db.s.transaction(async transaction => {
        const result = await entity.findAll(query, {transaction})
            .catch(e => {
                console.log(e);
            });

        if (result) {
            // delete each model object in the result array
            await P.map(result, (system) => {
                system.destroy({transaction});
            });

            if (entity !== db.remediation) {
                await remediationUpdated(req, transaction);
            }

            return result.length;
        }

        return 0;
    })
}

exports.remove = errors.async(function (req, res) {
    const id = req.params.id;
    const {tenant_org_id, username: created_by} = req.user;

    return findAndDestroy(req, db.remediation, {
        where: {
            id, tenant_org_id, created_by
        }
    }, res);
});

exports.bulkRemove = errors.async((req, res) => {
    const ids = req.body.remediation_ids;
    const {tenant_org_id, username: created_by} = req.user;

    // delete all specified remediations
    return db.remediation.destroy({where: {id: ids, tenant_org_id, created_by}})

    .then(result => {
        return res.status(200).json({deleted_count: result});
    });
});

exports.removeIssue = errors.async(function (req, res) {
    return findAndDestroy(req, db.issue, findIssueQuery(req), res);
});

// Remove all issues from specified remediation plan
//
// DELETE request body:
// {
//   "issue_ids": [
//     "advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074",
//     "vulnerabilities:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074"
//   ]
// }
exports.bulkRemoveIssues = errors.async(async function (req, res) {
    const issue_ids = req.body.issue_ids;
    const remediation_id = req.params.id;
    const {tenant_org_id, username: created_by} = req.user;

    // validate <user,tenant_org_id> owns remediation plan
    const removal_promise = db.remediation.findOne({where: {id: remediation_id, tenant_org_id, created_by}})
    .then(plan => {
        if (!plan) {
            // user's remediation plan not found
            return res.status(404).end();
        }

        // remove the specified issues.  This will cascade delete any issue_systems as well.
        return db.issue.destroy({where: {issue_id: issue_ids, remediation_id}})
        .then(count => {
            return res.status(200).json({deleted_count: count});
        });
    });

    return removal_promise;
});

exports.removeIssueSystem = errors.async(function (req, res) {
    const id = req.params.id;
    const iid = req.params.issue;
    const sid = req.params.system;
    const {account_number: tenant_org_id, username: created_by} = req.user;

    return findAndDestroy(req, db.issue_system, {
        where: {
            system_id: sid
        },
        include: {
            model: db.issue,
            required: true,
            where: {
                issue_id: iid
            },
            include: {
                model: db.remediation,
                required: true,
                where: {
                    id, account_number: tenant_org_id, created_by
                }
            }
        }
    }, res);
});

// Remove list of systems from remediation plan
//
// DELETE request body:
// {
//   "system_ids": [
//     "a8799a02-8be9-11e8-9eb6-529269fb1459",
//     "e96a2346-8e37-441d-963a-c2eed3ee856a",
//     "301653a2-4b5f-411c-8cb5-a74a96e2f344"
//   ]
// }
exports.bulkRemoveSystems = errors.async(async function (req, res) {
    const system_ids = req.body.system_ids;
    const remediation_id = req.params.id;
    const {tenant_org_id, username: created_by} = req.user;

    // validate <user,tenant_org_id> owns remediation plan
    const removal_promise = db.remediation.findOne({where: {id: remediation_id, tenant_org_id, created_by}})
        .then(async plan => {
            if (!plan) {
                // user's remediation plan not found
                return res.status(404).end();
            }

            const query = {
                where: {system_id: system_ids},
                include: {
                    model: db.issue,
                    required: true,
                    include: {
                        model: db.remediation,
                        required: true,
                        where: {id: remediation_id, tenant_org_id, created_by}
                    }
                }
            };

            const count = await findAllAndDestroy(req, db.issue_system, query, res);

            return res.status(200).json({deleted_count: count});
        });

    return removal_promise;
});

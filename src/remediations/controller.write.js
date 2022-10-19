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

async function validateNewActions(add) {
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

    // TODO: might be better to call these before the transaction
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

    if (add) {
        await validateNewActions(add);
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

    if (add) {
        await validateNewActions(add);
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

    // wrap this in a transaction so no one can delete something out from under us...
    return db.s.transaction(t => {
        // find all specified remediations...
        return db.remediation.findAll({where: {tenant_org_id, created_by, id: ids}})

        .then(remediations => {
            // check for missing items
            if (remediations.length !== ids.length) {
                const missing = _.differenceWith(ids, remediations, (id, rem) => {
                    return rem.id === id;
                });

                if (missing.length > 0) {
                    throw new errors.CompositeError(missing, 'One or more IDs are invalid');
                }
            }

            // delete all specified remediations
            return db.remediation.destroy({transaction: t, where: {id: ids, tenant_org_id, created_by}})
        })
    })

    .then(result => {
        return res.sendStatus(204);
    })

    .catch(error => {
        if (error instanceof errors.CompositeError) {
            const payload = {
                errors: [{
                    id: req.id,
                    status: 400,
                    code: 'UNKNOWN_REMEDIATION_ID',
                    title: error.message,
                    details: {remediation_ids: error.errors}
                }]
            }

            return res.status(400).json(payload);
        }
    })
});

exports.removeIssue = errors.async(function (req, res) {
    return findAndDestroy(req, db.issue, findIssueQuery(req), res);
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

'use strict';

const uuid = require('uuid');
const _ = require('lodash');
const P = require('bluebird');

const config = require('../config');
const errors = require('../errors');
const db = require('../db');
const format = require('./remediations.format');
const resolutions = require('../resolutions');
const inventory = require('../connectors/inventory');

const notFound = res => res.status(404).json();

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
        P.all(add.issues.map(issue => resolutions.resolveResolution(issue.id, issue.resolution)))
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
    const {add, name, auto_reboot} = req.swagger.params.body.value;

    if (add) {
        await validateNewActions(add);
    }

    const id = uuid.v4();

    const result = await db.s.transaction(async transaction => {
        const remediation = await db.remediation.create({
            id,
            name,
            auto_reboot,
            tenant: req.identity.account_number,
            created_by: req.identity.id,
            updated_by: req.identity.id
        }, {transaction});

        if (add) {
            await storeNewActions(remediation, add, transaction);
        }

        return remediation;
    });

    res.status(201)
    .set('Location', `${config.path.base}/v1/remediations/${id}`)
    .json(format.get(result));
});

exports.patch = errors.async(async function (req, res) {
    const id = req.swagger.params.id.value;
    const {account_number: tenant, id: userId} = req.identity;
    const {add, name, auto_reboot} = req.swagger.params.body.value;

    if (_.isUndefined(add) && _.isUndefined(name) && _.isUndefined(auto_reboot)) {
        throw new errors.BadRequest('EMPTY_REQUEST', 'At least one of "add", "name", "auto_reboot" needs to be specified');
    }

    if (add) {
        await validateNewActions(add);
    }

    const result = await db.s.transaction(async transaction => {
        const remediation = await db.remediation.findOne({
            attributes: ['id'],
            where: { id, tenant, created_by: userId },
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

        remediation.updated_by = userId;
        await remediation.save({transaction});

        return true;
    });

    result && res.status(200).end();
});

exports.patchIssue = errors.async(async function (req, res) {
    const iid = req.swagger.params.issue.value;
    const { resolution: rid } = req.swagger.params.body.value;

    // validate that the given resolution exists
    await resolutions.resolveResolution(iid, rid);

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
    const id = req.swagger.params.id.value;
    const iid = req.swagger.params.issue.value;
    const {account_number: tenant, id: created_by} = req.identity;

    return {
        where: {
            issue_id: iid,
            remediation_id: id
        },
        include: {
            model: db.remediation,
            required: true,
            where: {
                id, tenant, created_by
            }
        }
    };
}

function remediationUpdated (req, transaction) {
    const {account_number: tenant, id: userId} = req.identity;

    return db.remediation.update({
        updated_by: userId
    }, {
        where: {tenant, created_by: userId, id: req.swagger.params.id.value},
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
    const id = req.swagger.params.id.value;
    const {account_number: tenant, id: created_by} = req.identity;

    return findAndDestroy(req, db.remediation, {
        where: {
            id, tenant, created_by
        }
    }, res);
});

exports.removeIssue = errors.async(function (req, res) {
    return findAndDestroy(req, db.issue, findIssueQuery(req), res);
});

exports.removeIssueSystem = errors.async(function (req, res) {
    const id = req.swagger.params.id.value;
    const iid = req.swagger.params.issue.value;
    const sid = req.swagger.params.system.value;
    const {account_number: tenant, id: created_by} = req.identity;

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
                    id, tenant, created_by
                }
            }
        }
    }, res);
});

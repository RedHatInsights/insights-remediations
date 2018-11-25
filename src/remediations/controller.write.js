'use strict';

const uuid = require('uuid');

const errors = require('../errors');
const db = require('../db');
const format = require('./remediations.format');
const resolutions = require('../resolutions');

const notFound = res => res.status(404).json();

exports.create = errors.async(async function (req, res) {
    const { name } = req.swagger.params.body.value;

    const result = await db.remediation.create({
        id: uuid.v4(),
        name,
        tenant: req.identity.account_number,
        owner: req.identity.id
    });

    // TODO: 201 header
    res.status(201).json(format.get(result));
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
        return true;
    });

    if (result) {
        return res.status(200).end();
    }
});

function findIssueQuery (req) {
    const id = req.swagger.params.id.value;
    const iid = req.swagger.params.issue.value;
    const {account_number: tenant, id: owner} = req.identity;

    return {
        where: {
            issue_id: iid,
            remediation_id: id
        },
        include: {
            model: db.remediation,
            required: true,
            where: {
                id, tenant, owner
            }
        }
    };
}

function findAndDestroy (entity, query, res) {
    return db.s.transaction(async transaction => {
        const result = await entity.findOne(query, {transaction});

        if (result) {
            await result.destroy({transaction});
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
    const {account_number: tenant, id: owner} = req.identity;

    return findAndDestroy(db.remediation, {
        where: {
            id, tenant, owner
        }
    }, res);
});

exports.removeIssue = errors.async(function (req, res) {
    return findAndDestroy(db.issue, findIssueQuery(req), res);
});

exports.removeIssueSystem = errors.async(function (req, res) {
    const id = req.swagger.params.id.value;
    const iid = req.swagger.params.issue.value;
    const sid = req.swagger.params.system.value;
    const {account_number: tenant, id: owner} = req.identity;

    return findAndDestroy(db.issue_system, {
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
                    id, tenant, owner
                }
            }
        }
    }, res);
});

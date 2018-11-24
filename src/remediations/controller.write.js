'use strict';

const errors = require('../errors');
const db = require('../db');
const format = require('./remediations.format');
const uuid = require('uuid');

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
    const id = req.swagger.params.id.value;
    const iid = req.swagger.params.issue.value;
    const {account_number: tenant, id: owner} = req.identity;

    return findAndDestroy(db.issue, {
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
    }, res);
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

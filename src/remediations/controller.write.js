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

exports.remove = errors.async(function (req, res) {
    const id = req.swagger.params.id.value;
    const {account_number: tenant, id: owner} = req.identity;

    return db.s.transaction(async transaction => {
        const remediation = await db.remediation.findOne({
            where: {
                id, tenant, owner
            }
        }, {transaction});

        if (!remediation) {
            return notFound(res);
        }

        await remediation.destroy({transaction});
        return res.status(204).end();
    });
});

exports.removeIssue = errors.async(function (req, res) {
    const id = req.swagger.params.id.value;
    const iid = req.swagger.params.issue.value;
    const {account_number: tenant, id: owner} = req.identity;

    return db.s.transaction(async transaction => {
        const issue = await db.issue.findOne({
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
        }, {transaction});

        if (!issue) {
            return notFound(res);
        }

        await issue.destroy({transaction});
        return res.status(204).end();
    });
});

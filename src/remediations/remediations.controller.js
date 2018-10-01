'use strict';

const _ = require('lodash');
const uuid = require('uuid');
const errors = require('../errors');
const db = require('../db');

const notFound = res => res.status(404).json();

const REMEDIATION_ATTRIBUTES = ['id', 'name', 'tenant', 'owner'];
const ISSUE_ATTRIBUTES = ['issue_id', 'resolution'];

function publicRepresentation (remediation) {
    return _.pick(remediation, ['id', 'name', 'tenant', 'owner', 'issues']);
}

exports.list = errors.async(async function (req, res) {
    const remediations = await db.remediation.findAll({
        attributes: REMEDIATION_ATTRIBUTES,
        include: [{
            attributes: ISSUE_ATTRIBUTES,
            model: db.issue
        }],
        where: {
            tenant: req.identity.account_number,
            owner: req.identity.id
        }
    });

    res.json({remediations});
});

exports.get = errors.async(async function (req, res) {
    const remediation = await db.remediation.findOne({
        attributes: REMEDIATION_ATTRIBUTES,
        include: [{
            attributes: ISSUE_ATTRIBUTES,
            model: db.issue
        }],
        where: {
            id: req.swagger.params.id.value,
            tenant: req.identity.account_number,
            owner: req.identity.id
        }
    });

    if (!remediation) {
        return notFound(res);
    }

    res.json(publicRepresentation(remediation));
});

exports.create = errors.async(async function (req, res) {
    const { name } = req.swagger.params.body.value;

    const remediation = await db.remediation.create({
        id: uuid.v4(),
        name,
        tenant: req.identity.account_number,
        owner: req.identity.id
    });

    // TODO: 201 header
    res.status(201).json(publicRepresentation(remediation));
});

exports.remove = errors.async(function (req, res) {
    return db.s.transaction(async transaction => {
        const remediation = await db.remediation.findById(req.swagger.params.id.value, {transaction});

        if (!remediation) {
            return notFound(res);
        }

        await remediation.destroy({transaction});
        res.status(204).end();
    });
});

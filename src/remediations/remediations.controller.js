'use strict';

const uuid = require('uuid');
const errors = require('../errors');
const db = require('../db');

const notFound = res => res.status(404).json();

exports.list = errors.async(async function (req, res) {
    const remediations = await db.remediation.findAll();
    res.json({remediations});
});

exports.get = errors.async(async function (req, res) {
    const remediation = await db.remediation.findById(req.swagger.params.id.value);

    if (!remediation) {
        return notFound(res);
    }

    res.json(remediation);
});

exports.create = errors.async(async function (req, res) {
    const { name } = req.swagger.params.body.value;

    const remediation = await db.remediation.create({
        id: uuid.v4(),
        name
    });

    // TODO: 201 header
    res.status(201).json(remediation);
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

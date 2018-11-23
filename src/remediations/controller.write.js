'use strict';

const errors = require('../errors');
const db = require('./remediations.db');
const format = require('./remediations.format');

const notFound = res => res.status(404).json();

exports.create = errors.async(async function (req, res) {
    const { name } = req.swagger.params.body.value;

    const result = await db.create({
        name,
        tenant: req.identity.account_number,
        owner: req.identity.id
    });

    // TODO: 201 header
    res.status(201).json(format.get(result));
});

exports.remove = errors.async(async function (req, res) {
    const result = await db.destroy(req.swagger.params.id.value, req.identity.account_number, req.identity.id);
    result ? res.status(204).end() : notFound(res);
});

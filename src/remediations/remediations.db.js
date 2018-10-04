'use strict';

const db = require('../db');
const uuid = require('uuid');

const REMEDIATION_ATTRIBUTES = ['id', 'name', 'tenant', 'owner', 'updated_at'];
const ISSUE_ATTRIBUTES = ['issue_id', 'resolution'];

exports.list = function (tenant, owner) {
    return db.remediation.findAll({
        attributes: REMEDIATION_ATTRIBUTES,
        include: [{
            attributes: ISSUE_ATTRIBUTES,
            model: db.issue,
            required: false,
            include: [{
                attributes: ['id'],
                model: db.system,
                required: true,
                through: {
                    attributes: []
                }
            }]
        }],
        where: {
            tenant, owner
        },
        order: ['id']
    });
};

exports.get = function (id, tenant, owner) {
    return db.remediation.findOne({
        attributes: REMEDIATION_ATTRIBUTES,
        include: [{
            attributes: ISSUE_ATTRIBUTES,
            model: db.issue,
            include: {
                attributes: ['id'],
                model: db.system,
                through: {
                    attributes: []
                }
            }
        }],
        where: {
            id, tenant, owner
        }
    });
};

exports.create = function (remediation) {
    return db.remediation.create({
        id: uuid.v4(),
        ...remediation
    });
};

exports.destroy = function (id, tenant, owner) {
    return db.s.transaction(async transaction => {
        const remediation = await db.remediation.findOne({
            where: {
                id, tenant, owner
            }
        }, {transaction});

        if (!remediation) {
            return false;
        }

        await remediation.destroy({transaction});
        return true;
    });
};

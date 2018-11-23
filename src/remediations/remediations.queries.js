'use strict';

const db = require('../db');

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

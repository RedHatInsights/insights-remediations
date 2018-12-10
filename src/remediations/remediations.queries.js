'use strict';

const db = require('../db');

const REMEDIATION_ATTRIBUTES = ['id', 'name', 'auto_reboot', 'tenant', 'created_by', 'created_at', 'updated_by', 'updated_at'];
const ISSUE_ATTRIBUTES = ['issue_id', 'resolution'];

exports.list = function (tenant, created_by, primaryOrder = 'updated_at', asc = true) {
    return db.remediation.findAll({
        attributes: REMEDIATION_ATTRIBUTES,
        include: [{
            attributes: ISSUE_ATTRIBUTES,
            model: db.issue,
            required: false,
            include: [{
                attributes: ['system_id'],
                association: db.issue.associations.systems,
                required: true
            }]
        }],
        where: {
            tenant, created_by
        },
        order: [
            [primaryOrder, asc ? 'ASC' : 'DESC'],
            'id'
        ]
    });
};

exports.get = function (id, tenant, created_by) {
    return db.remediation.findOne({
        attributes: REMEDIATION_ATTRIBUTES,
        include: [{
            attributes: ISSUE_ATTRIBUTES,
            model: db.issue,
            include: {
                attributes: ['system_id'],
                association: db.issue.associations.systems,
                required: true
            }
        }],
        where: {
            id, tenant, created_by
        },
        order: [
            ['id'],
            [db.issue, 'issue_id'],
            [db.issue, db.issue.associations.systems, 'system_id']
        ]
    });
};

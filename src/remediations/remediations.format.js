'use strict';

const _ = require('lodash');

exports.list = function (remediations) {
    const formatted = _.map(remediations, remediation => _.pick(remediation, [
        'id',
        'name',
        'owner',
        'updated_at',
        'needsReboot',
        'systemCount',
        'issueCount'
    ]));

    return {
        remediations: formatted
    };
};

exports.get = function ({id, name, updated_at, owner, issues}) {
    return {
        id,
        name,
        updated_at,
        owner,
        issues: _.map(issues, ({issue_id, resolution, details, systems}) => ({
            issue_id,
            description: details.description,
            resolution: {
                description: resolution.description,
                riskOfChange: resolution.riskOfChange,
                needsReboot: resolution.needsReboot
            },
            systems: systems.map(({id, hostname, display_name}) => ({
                id,
                hostname,
                display_name: display_name || 'null' // FIXME
            }))
        }))
    };
};

'use strict';

const _ = require('lodash');

exports.list = function (remediations) {
    const formatted = _.map(remediations, remediation => _.pick(remediation, [
        'id',
        'name',
        'owner',
        'updated_at',
        'needs_reboot',
        'system_count',
        'issue_count'
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
            id: issue_id,
            description: details.description,
            resolution: {
                id: resolution.type,
                description: resolution.description,
                resolution_risk: resolution.resolutionRisk,
                needs_reboot: resolution.needsReboot
            },
            systems: systems.map(({system_id, hostname, display_name}) => ({
                id: system_id,
                hostname,
                display_name: display_name || 'null' // FIXME
            }))
        }))
    };
};

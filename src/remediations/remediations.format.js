'use strict';

const _ = require('lodash');
const URI = require('urijs');

const DEFAULT_REMEDIATION_NAME = 'unnamed-playbook';
const PLAYBOOK_SUFFIX = 'yml';
const config = require('../config');

function buildListLink (limit, page) {
    return new URI(config.path.base).segment('v1').segment('remediations').query({limit, offset: page * limit}).toString();
}

function buildListLinks (total, count, limit, offset) {
    const lastPage = Math.floor(Math.max(total - 1, 0) / limit);
    const currentPage = Math.floor(offset / limit);
    const remainder = offset % limit;

    const links = {
        first: buildListLink(limit, 0),
        last: buildListLink(limit, lastPage),

        previous: (offset > 0) ? buildListLink(limit, (remainder === 0) ? currentPage - 1 : currentPage) : null,
        next: (currentPage < lastPage) ? buildListLink(limit, currentPage + 1) : null
    };

    return links;
}

exports.list = function (remediations, total, limit, offset) {
    const formatted = _.map(remediations,
        ({id, name, needs_reboot, created_by, created_at, updated_by, updated_at, system_count, issue_count}) => ({
            id,
            name,
            created_by: _.pick(created_by, ['username', 'first_name', 'last_name']),
            created_at: created_at.toISOString(),
            updated_by: _.pick(updated_by, ['username', 'first_name', 'last_name']),
            updated_at: updated_at.toISOString(),
            needs_reboot,
            system_count,
            issue_count
        })
    );

    return {
        meta: {
            count: remediations.length,
            total
        },
        links: buildListLinks(total, remediations.count, limit, offset),
        data: formatted
    };
};

exports.get = function ({id, name, needs_reboot, auto_reboot, created_by, created_at, updated_by, updated_at, issues}) {
    return {
        id,
        name,
        needs_reboot,
        auto_reboot,
        created_by: _.pick(created_by, ['username', 'first_name', 'last_name']),
        created_at: created_at.toISOString(),
        updated_by: _.pick(updated_by, ['username', 'first_name', 'last_name']),
        updated_at: updated_at.toISOString(),
        issues: _.map(issues, ({issue_id, resolution, details, systems, resolutionsAvailable }) => ({
            id: issue_id,
            description: details.description,
            resolution: {
                id: resolution.type,
                description: resolution.description,
                resolution_risk: resolution.resolutionRisk,
                needs_reboot: resolution.needsReboot
            },
            resolutions_available: resolutionsAvailable,
            systems: systems.map(({system_id, hostname, display_name}) => ({
                id: system_id,
                hostname,
                display_name
            }))
        }))
    };
};

exports.created = function ({id}) {
    return {id};
};

function playbookNamePrefix (name) {
    if (!name || !name.length) {
        return DEFAULT_REMEDIATION_NAME;
    }

    let result = name.toLowerCase().trim(); // no capital letters
    result = result.replace(/\s+/g, '-'); // no whitespace
    result = result.replace(/[^\w-]/g, ''); // only alphanumeric, hyphens or underscore
    return result;
}

exports.playbookName = function (remediation) {
    const name = playbookNamePrefix(remediation.name);
    const fileName = [name, new Date().getTime()];

    // my-remediation-1462522068064.yml
    return `${fileName.join('-')}.${PLAYBOOK_SUFFIX}`;
};

'use strict';

const _ = require('lodash');
const URI = require('urijs');

const DEFAULT_REMEDIATION_NAME = 'unnamed-playbook';
const USER = ['username', 'first_name', 'last_name'];
const PLAYBOOK_SUFFIX = 'yml';
const config = require('../config');

const listLinkBuilder = (sort, system) => (limit, page) =>
    new URI(config.path.base)
    .segment('v1')
    .segment('remediations')
    .query({system, sort, limit, offset: page * limit})
    .toString();

function buildListLinks (total, limit, offset, sort, system) {
    const lastPage = Math.floor(Math.max(total - 1, 0) / limit);
    const currentPage = Math.floor(offset / limit);
    const remainder = offset % limit;
    const builder = listLinkBuilder(sort, system);

    const links = {
        first: builder(limit, 0),
        last: builder(limit, lastPage),

        previous: (offset > 0) ? builder(limit, (remainder === 0) ? currentPage - 1 : currentPage) : null,
        next: (currentPage < lastPage) ? builder(limit, currentPage + 1) : null
    };

    return links;
}

exports.list = function (remediations, total, limit, offset, sort, system) {
    const formatted = _.map(remediations,
        ({id, name, needs_reboot, created_by, created_at, updated_by, updated_at, system_count, issue_count}) => ({
            id,
            name,
            created_by: _.pick(created_by, USER),
            created_at: created_at.toISOString(),
            updated_by: _.pick(updated_by, USER),
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
        links: buildListLinks(total, limit, offset, sort, system),
        data: formatted
    };
};

exports.get = function ({id, name, needs_reboot, auto_reboot, created_by, created_at, updated_by, updated_at, issues}) {
    return {
        id,
        name,
        needs_reboot,
        auto_reboot,
        created_by: _.pick(created_by, USER),
        created_at: created_at.toISOString(),
        updated_by: _.pick(updated_by, USER),
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

exports.connectionStatus = function (executors) {
    const data = _(executors)
    .sortBy('name')
    .map(executor => ({
        executor_id: executor.satId || null,
        executor_type: executor.type,
        executor_name: executor.name,
        system_count: executor.systems.length,
        connection_status: executor.status
    }))
    .value();

    return {
        meta: {
            count: data.length,
            total: data.length
        },
        data
    };
};

function getUniqueHosts (issues) {
    return _(issues).flatMap('hosts').uniq().sort().value();
}

exports.playbookRunRequest = function (remediation, issues, playbook, playbookRunId) {
    const uniqueHosts = getUniqueHosts(issues);

    return {
        remediation_id: remediation.id,
        remediation_name: remediation.name,
        playbook_run_id: playbookRunId,
        account: remediation.account_number,
        hosts: uniqueHosts,
        playbook: playbook.yaml,
        config: {
            text_updates: config.fifi.text_updates,
            text_update_interval: config.fifi.text_update_interval,
            text_update_full: config.fifi.text_update_full
        }
    };
};

exports.receptorWorkRequest = function (playbookRunRequest, account_number, receptor_id) {
    return {
        account: account_number,
        recipient: receptor_id,
        payload: JSON.stringify(playbookRunRequest),
        directive: 'receptor_satellite:execute'
    };
};

exports.playbookRuns = function (playbook_runs) {
    const formatted = playbook_runs.map(run => ({
        id: run.id,
        status: run.status,
        remediation_id: run.remediation_id,
        created_by: _.pick(run.created_by, USER),
        created_at: run.created_at.toISOString(),
        updated_at: run.updated_at.toISOString(),
        executors: run.executors.map(executor => ({
            executor_id: executor.executor_id,
            executor_name: executor.executor_name,
            system_count: executor.get('system_count')
        }))
    }));

    return {
        meta: {
            count: playbook_runs.length,
            total: playbook_runs.length
        },
        data: formatted
    };
};

exports.playbookRunDetails = function (playbook_runs) {
    const formatted = playbook_runs.map(run => ({
        id: run.id,
        status: run.status,
        remediation_id: run.remediation_id,
        created_by: _.pick(run.created_by, USER),
        created_at: run.created_at.toISOString(),
        updated_at: run.updated_at.toISOString(),
        executors: run.executors.map(executor => ({
            executor_id: executor.executor_id,
            executor_name: executor.executor_name,
            updated_at: executor.updated_at.toISOString(),
            playbook: executor.playbook,
            playbook_run_id: executor.playbook_run_id,
            status: executor.status,
            system_count: executor.get('system_count')
        }))
    }));

    return formatted[0];
};

exports.playbookSystems = function (systems) {
    const formatted = systems.map(system => ({
        id: system.id,
        system_id: system.system_id,
        system_name: system.system_name,
        status: system.status,
        updated_at: system.updated_at.toISOString(),
        playbook_run_executor_id: system.playbook_run_executor_id
    }));

    return {
        meta: {
            count: formatted.length,
            total: formatted.length
        },
        data: formatted
    };
};

exports.playbookSystemDetails = function (system) {
    const formatted = {
        id: system.id,
        system_id: system.system_id,
        system_name: system.system_name,
        status: system.status,
        console: system.console,
        updated_at: system.updated_at.toISOString(),
        playbook_run_executor_id: system.get('executor_id')
    };

    return formatted;
};

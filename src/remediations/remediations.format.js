'use strict';
/* eslint-disable max-len */

const _ = require('lodash');
const URI = require('urijs');

const DEFAULT_REMEDIATION_NAME = 'unnamed-playbook';
const USER = ['username', 'first_name', 'last_name'];
const PLAYBOOK_SUFFIX = 'yml';
const config = require('../config');
const {filterIssuesPerExecutor} = require("./fifi");
const {systemToHost} = require("../generator/generator.controller");

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

function buildRHCUrl (remediation_id, system_id) {
    return `https://${config.platformHostname}${config.path.prefix}/${config.path.app}/v1/${config.path.app}/${remediation_id}/playbook?hosts=${system_id}&localhost`;
}

// Build URL for fetching rhc-satellite playbooks
// e.g.: https://hostname/api/remediations/v1/remediations/42503118-80d4-49e0-bfee-20ac2d8ea74f/playbook?hosts=29dafba0-c190-4acd-998d-074ba0aee477&hosts=fc84c991-a029-4882-bc9c-7e351a73b59f
function buildRHCSatUrl(remediation_id, systems) {
    const ids = _(systems).map('inventory_id').value();

    let url = new URI(`https://${config.platformHostname}`)
        .segment([config.path.prefix, config.path.app, 'v1', config.path.app, remediation_id, 'playbook'])
        .search({hosts: ids})
        .toString();

    return url;
}

exports.parseSort = function (param) {
    if (!param) {
        throw new Error(`Invalid sort param value ${param}`);
    }

    if (param.startsWith('-')) {
        return {
            column: param.substring(1),
            asc: false
        };
    }

    return {
        column: param,
        asc: true
    };
};

exports.list = function (remediations, total, limit, offset, sort, system) {
    const formatted = _.map(remediations,
        ({id, name, needs_reboot, created_by, created_at, updated_by, updated_at, system_count, issue_count, resolved_count, archived, playbook_runs}) => ({
            id,
            name,
            created_by: _.pick(created_by, USER),
            created_at: created_at.toISOString(),
            updated_by: _.pick(updated_by, USER),
            updated_at: updated_at.toISOString(),
            needs_reboot,
            system_count,
            issue_count,
            resolved_count: (resolved_count === null) ? 0 : resolved_count,
            archived,
            playbook_runs: (playbook_runs === null) ? [] : playbook_runs
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

exports.get = function ({id, name, needs_reboot, auto_reboot, created_by, created_at, updated_by, updated_at, issues, resolved_count, archived}) {
    return {
        id,
        name,
        needs_reboot,
        auto_reboot,
        archived,
        created_by: _.pick(created_by, USER),
        created_at: created_at.toISOString(),
        updated_by: _.pick(updated_by, USER),
        updated_at: updated_at.toISOString(),
        resolved_count: (resolved_count === null) ? 0 : resolved_count,
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
            systems: systems.map(({system_id, hostname, display_name, resolved}) => ({
                id: system_id,
                hostname,
                display_name,
                resolved
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
        endpoint_id: executor.endpointId || null,
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

exports.playbookRunRequest = function (remediation, issues, playbook, playbookRunId, text_update_full, text_update_interval) {
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
            text_update_interval,
            text_update_full
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

exports.rhcWorkRequest = function (rhc_client_id, account_number, remediation_id, system_id, playbook_run_id) {
    return {
        recipient: rhc_client_id,
        account: account_number,
        url: buildRHCUrl(remediation_id, system_id),
        labels: { 'playbook-run': playbook_run_id },
        hosts: [{ansible_host: 'localhost', inventory_id: system_id}]
    };
};

exports.rhcSatelliteWorkRequest = function (executor, remediation, username, tenant_org_id, playbook_run_id) {
    const systems = executor.systems.map(system => {
        let host = {"inventory_id": system.id};

        if (!_.isNull(system.ansible_host)) {
            host.absible_host = system.ansible_host;
        }

        return host;
    });

    const request = {
        recipient: executor.satRhcId,
        org_id: tenant_org_id,
        principal: username,
        name: remediation.name,
        recipient_config: {
            sat_id: executor.satId,
            sat_org_id: executor.satOrgId.toString()
        },
        url: buildRHCSatUrl(remediation.id, systems),
        labels: { 'playbook-run': playbook_run_id },
        hosts: systems,
        web_console_url: "https://console.redhat.com/insights/remediations",
    };

    return request;
};

exports.playbookCancelRequest = function (playbookRunId) {
    return {
        type: 'playbook_run_cancel',
        playbook_run_id: playbookRunId
    };
};

exports.receptorCancelRequest = function (playbookCancelRequest, account_number, receptor_id) {
    return {
        account: account_number,
        recipient: receptor_id,
        payload: JSON.stringify(playbookCancelRequest),
        directive: 'receptor_satellite:cancel'
    };
};

// Returns an array of formatted playbook runs for inclusion in a response.
exports.formatRuns = (playbookRuns) => {
    return playbookRuns.map(run => ({
        id: run.id,
        status: run.status,
        remediation_id: run.remediation_id,
        created_by: _.pick(run.created_by, USER),
        created_at: (_.isDate(run.created_at)) ? run.created_at.toISOString() : run.created_at,
        updated_at: (_.isDate(run.updated_at)) ? run.updated_at.toISOString() : run.updated_at,
        executors: run.executors.map(executor => ({
            executor_id: executor.executor_id,
            executor_name: executor.executor_name,
            status: executor.status,
            system_count: executor.system_count,
            counts: {
                pending: executor.count_pending,
                running: executor.count_running,
                success: executor.count_success,
                failure: executor.count_failure,
                canceled: executor.count_canceled
            }
        }))
    }));
};

exports.playbookRuns = function (playbook_runs, total) {
    const formatted = exports.formatRuns(playbook_runs);

    return {
        meta: {
            count: playbook_runs.length,
            total
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
        created_at: (_.isDate(run.created_at)) ? run.created_at.toISOString() : run.created_at,
        updated_at: (_.isDate(run.updated_at)) ? run.updated_at.toISOString() : run.updated_at,
        executors: run.executors.map(executor => ({
            executor_id: executor.executor_id,
            executor_name: executor.executor_name,
            updated_at: (_.isDate(run.updated_at)) ? run.updated_at.toISOString() : run.updated_at,
            playbook: executor.playbook,
            playbook_run_id: executor.playbook_run_id,
            status: executor.status,
            system_count: executor.system_count,
            counts: {
                pending: executor.count_pending,
                running: executor.count_running,
                success: executor.count_success,
                failure: executor.count_failure,
                canceled: executor.count_canceled
            }
        }))
    }));

    return formatted[0];
};

exports.playbookSystems = function (systems, total) {
    const formatted = systems.map(system => ({
        system_id: system.system_id,
        system_name: system.system_name,
        status: system.status,
        updated_at: (_.isDate(system.updated_at)) ? system.updated_at.toISOString() : system.updated_at,
        playbook_run_executor_id: system.playbook_run_executor_id
    }));

    return {
        meta: {
            count: formatted.length,
            total
        },
        data: formatted
    };
};

exports.playbookSystemDetails = function (system) {
    const formatted = {
        system_id: system.system_id,
        system_name: system.system_name,
        status: system.status,
        console: system.console,
        updated_at: (_.isDate(system.updated_at)) ? system.updated_at.toISOString() : system.updated_at,
        playbook_run_executor_id: system.executor_id
    };

    return formatted;
};

exports.issueSystems = function (issue, total) {
    const formatted = issue.systems.map(system => ({
        id: system.system_id,
        hostname: system.hostname,
        display_name: system.display_name
    }));

    return {
        meta: {
            count: formatted.length,
            total
        },
        data: formatted
    };
};

'use strict';

const _ = require('lodash');
const P = require('bluebird');
const uuid = require('uuid/v4');

const format = require('./remediations.format');
const generator = require('../generator/generator.controller');
const inventory = require('../connectors/inventory');
const sources = require('../connectors/sources');
const receptorConnector = require('../connectors/receptor');
const log = require('../util/log');
const probes = require('../probes');
const read = require('./controller.read');

const SATELLITE_NAMESPACE = Object.freeze({namespace: 'satellite'});
const SYSTEM_FIELDS = Object.freeze(['id', 'ansible_host', 'hostname', 'display_name']);

async function fetchSystems (ids) {
    const systemDetails = await inventory.getSystemDetailsBatch(ids);

    return _(ids).map(id => _.get(systemDetails, id)).filter().value();
}

function getSatelliteId (facts) {
    const satelliteFacts = _.find(facts, SATELLITE_NAMESPACE);

    if (satelliteFacts) {
        return satelliteFacts.facts.satellite_instance_id;
    }

    return null;
}

function getReceptor (source) {
    if (!source) {
        return null;
    }

    return _.find(source.endpoints, {default: true});
}

async function fetchReceptorStatus (receptor, account) {
    if (!receptor) {
        return null;
    }

    const result = await receptorConnector.getConnectionStatus(account, receptor.receptor_node);
    return _.get(result, 'status', null);
}

function getName (executor) {
    if (executor.source) {
        return executor.source.name;
    }

    if (executor.id) {
        return `Satellite ${executor.id}`;
    }

    return null;
}

function getStatus (executor) {
    if (!executor.id) {
        return 'no_executor';
    }

    if (!executor.source) {
        return 'no_source';
    }

    if (!executor.receptor) {
        return 'no_receptor';
    }

    if (executor.receptorStatus !== 'connected') {
        return 'disconnected';
    }

    return 'connected';
}

function normalize (satellites) {
    return _.map(satellites, satellite => ({
        satId: satellite.id,
        receptorId: _.get(satellite.receptor, 'receptor_node', null),
        systems: _.map(satellite.systems, system => _.pick(system, SYSTEM_FIELDS)),
        type: satellite.id ? 'satellite' : null,
        name: getName(satellite),
        status: getStatus(satellite)
    }));
}

exports.resolveUsers = async function (req, remediation) {
    const usernames = remediation.playbook_runs.map(run => {
        return run.created_by;
    });
    const resolvedUsersById = await read.getUsers(req, usernames);

    remediation.playbook_runs.forEach(run => {
        run.created_by = read.getUser(resolvedUsersById, run.created_by);
    });

    return remediation;
};

exports.generatePlaybookRunId = function () {
    return uuid();
};

exports.getConnectionStatus = async function (remediation, account) {
    const systemsIds = _(remediation.issues).flatMap('systems').map('system_id').uniq().sort().value();
    const systems = await fetchSystems(systemsIds);

    _.forEach(systems, system => system.satelliteId = getSatelliteId(system.facts));

    const satellites = _(systems).groupBy('satelliteId').mapValues(systems => ({
        id: systems[0].satelliteId,
        systems
    })).values().value();

    const sourceInfo = await sources.getSourceInfo(_(satellites).map('id').filter().value());

    _.forEach(satellites, satellite => {
        satellite.source = _.get(sourceInfo, satellite.id, null);
        satellite.receptor = getReceptor(satellite.source);
    });

    await P.map(satellites, async satellite => {
        satellite.receptorStatus = await fetchReceptorStatus(satellite.receptor, account);
    });

    return normalize(satellites);
};

exports.filterIssuesPerExecutor = async function (systems, remediationIssues) {
    const executorSystemsById = _.keyBy(systems, 'id');
    const filtered = _(_.cloneDeep(remediationIssues))
    .map(issue => ({
        ...issue,
        systems: _.filter(issue.systems, system => _.has(executorSystemsById, system.system_id))
    }))
    .filter(issue => issue.systems.length)
    .value();

    return filtered;
};

exports.sendInitialRequest = async function (status, remediation, account) {
    const playbook_run_id = exports.generatePlaybookRunId();
    const executors = _.filter(status, {status: 'connected'});
    const remediationIssues = remediation.toJSON().issues;

    if (_.isEmpty(executors)) {
        return null;
    }

    await P.mapSeries(executors, async (executor, index) => {
        try {
            const filteredIssues = generator.normalizeIssues(
                await exports.filterIssuesPerExecutor(executor.systems, remediationIssues)
            );

            const playbook = await generator.playbookPipeline ({
                issues: filteredIssues,
                auto_reboot: remediation.auto_reboot
            }, remediation, false);

            const resolvedIssues = await generator.resolveSystems(filteredIssues);
            const receptorWorkRequest = format.receptorWorkRequest(format.playbookRunRequest(
                remediation,
                resolvedIssues,
                playbook,
                playbook_run_id), account, executor.receptorId);

            probes.splitPlaybookPerSatId(receptorWorkRequest, executor.satId);
            return await receptorConnector.postInitialRequest(receptorWorkRequest);
        } catch (e) {
            if (index !== 0) {
                log.error({executor: executor.id, error: e}, 'error sending Playbook to executor');
                return null;
            }

            throw e;
        }
    });

    return playbook_run_id;
};

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

const SATELLITE_TAG = Object.freeze({namespace: 'satellite', key: 'satellite_id'});
const SYSTEM_FIELDS = Object.freeze(['id', 'ansible_host', 'hostname', 'display_name']);

async function fetchSystems (ids) {
    const [systemDetails, systemTags] = await P.all([
        inventory.getSystemDetailsBatch(ids),
        inventory.getTagsByIds(ids)
    ]);

    return _(ids).map(id => _.get(systemDetails, id)).filter().map(system => {
        system.tags = _.get(systemTags, system.id, []);
        return system;
    }).value();
}

function getSatelliteId (tags) {
    const tag = _.find(tags, SATELLITE_TAG);
    if (tag) {
        return tag.value;
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

exports.generatePlaybookRunId = function () {
    return uuid();
};

exports.getConnectionStatus = async function (remediation, account) {
    const systemsIds = _(remediation.issues).flatMap('systems').map('system_id').uniq().sort().value();
    const systems = await fetchSystems(systemsIds);

    _.forEach(systems, system => system.satelliteId = getSatelliteId(system.tags));

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

    try {
        await P.mapSeries(executors, async (executor, index) => {
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

            const result = await receptorConnector.postInitialRequest(receptorWorkRequest);

            if (index === 0 && _.isError(result)) {
                throw result;
            }

            if (!index === 0 && _.isError(result)) {
                log.error('ERROR: Receptor Connecter failed to post a work request');
            }
        });
    } catch (e) {
        return e;
    }

    return {id: playbook_run_id};
};

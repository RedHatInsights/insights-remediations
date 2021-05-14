'use strict';
/* eslint-disable max-len */

const _ = require('lodash');
const P = require('bluebird');
const {v4: uuidv4} = require('uuid');

const config = require('../config');
const errors = require('../errors');
const format = require('./remediations.format');
const generator = require('../generator/generator.controller');
const inventory = require('../connectors/inventory');
const sources = require('../connectors/sources');
const configManager = require('../connectors/configManager');
const receptorConnector = require('../connectors/receptor');
const dispatcher = require('../connectors/dispatcher');
const log = require('../util/log');
const probes = require('../probes');
const read = require('./controller.read');
const queries = require('./remediations.queries');

const SATELLITE_NAMESPACE = Object.freeze({namespace: 'satellite'});
const SYSTEM_FIELDS = Object.freeze(['id', 'ansible_host', 'hostname', 'display_name', 'rhc_client']);

const RUNSFIELDS = Object.freeze({fields: {data: ['id', 'labels', 'status', 'service', 'created_at', 'updated_at', 'url']}});
const RUNHOSTFIELDS = Object.freeze({fields: {data: ['stdout']}});
const RHCSTATUSES = ['timeout', 'failure', 'success', 'running'];

const DIFF_MODE = false;
const FULL_MODE = true;

const CONNECTED = 'connected';
const DISABLED = 'disabled';
const PENDING = 'pending';
const FAILURE = 'failure';
const RUNNING = 'running';
const SUCCESS = 'success';
const SERVICE = 'remediations';

exports.checkSmartManagement = async function (remediation, smart_management) {
    // if customer has smart_management entitlement fastlane them
    if (smart_management) {
        return true;
    }

    // if check marketplace systems isn't turned on return false
    if (!config.isMarketplace) {
        return false;
    }

    const systemsIds = _(remediation.issues).flatMap('systems').map('system_id').uniq().sort().value();
    const systemsProfiles = await inventory.getSystemProfileBatch(systemsIds);

    return _.some(systemsProfiles, system => system.system_profile.is_marketplace === true);
};

exports.checkRhcEnabled = async function () {
    const rhcStates = await configManager.getCurrentState();

    if (rhcStates.state.remediations === DISABLED) {
        return false;
    }

    return true;
};

exports.sortSystems = function (systems, column = 'system_name', asc = true) {
    return _.orderBy(systems, column, (asc) ? 'asc' : 'desc');
};

function createDispatcherRunsFilter (playbook_run_id = null) {
    // Based on the qs library used in dispatcher connector, define filter in this format
    const runsFilter = {filter: {}};
    runsFilter.filter.service = SERVICE;

    if (playbook_run_id) {
        runsFilter.filter.labels = {'playbook-run': playbook_run_id};
    }

    return runsFilter;
}

function createDispatcherRunHostsFilter (playbook_run_id, host_id = null) {
    const runHostsFilter = {filter: {run: {}}};
    runHostsFilter.filter.run.service = SERVICE;
    runHostsFilter.filter.run.labels = {'playbook-run': playbook_run_id};

    if (host_id) {
        runHostsFilter.filter.run.id = host_id;
    }

    return runHostsFilter;
}

function findRunStatus (run) {
    if (run.count_failure > 0 || run.count_timeout > 0) {
        return FAILURE;
    } else if (run.count_running > 0 && run.count_timeout === 0 && run.count_failure === 0) {
        return RUNNING;
    } else if (run.count_success > 0 && run.count_timeout === 0) {
        return SUCCESS;
    }
}

function formatRHCRuns (rhcRuns) {
    // Add system count
    rhcRuns.system_count = rhcRuns.meta.count;

    // Assign each status count
    RHCSTATUSES.forEach(status => {
        rhcRuns[`count_${status}`] = _.size(_.filter(rhcRuns.data, run => run.status === status));
    });

    // Status of executor
    rhcRuns.status = findRunStatus(rhcRuns);
}

exports.formatRunHosts = function (rhcRunHosts, playbook_run_id) {
    return _.map(rhcRunHosts.data, host => ({
        system_id: host.id,
        system_name: host.id,
        status: host.status,
        updated_at: host.updated_at,
        playbook_run_executor_id: playbook_run_id
    }));
};

function formatRHCHostDetails (host, details, playbook_run_id) {
    return {
        system_id: host.id,
        system_name: host.id,
        status: host.status,
        updated_at: host.updated_at,
        console: details.data[0].stdout,
        executor_id: playbook_run_id
    };
}

function pushRHCSystem (host, systems) {
    systems.push(host);
}

function pushRHCExecutor (rhcRun, satRun) {
    satRun.executors.push({
        executor_id: rhcRun.data[0].labels['playbook-run'],
        executor_name: 'Direct connected',
        status: rhcRun.status,
        system_count: rhcRun.system_count,
        playbook_run_id: rhcRun.data[0].labels['playbook-run'],
        playbook: rhcRun.data[0].url,
        updated_at: rhcRun.data[0].updated_at,
        count_failure: rhcRun.count_failure,
        count_success: rhcRun.count_success,
        count_running: rhcRun.count_running,
        count_pending: 0, // RHC does not return the status pending
        count_canceled: 0 // RHC does not currently return status canceled
    });
}

exports.getRHCRuns = async function (playbook_run_id = null) {
    const filter = createDispatcherRunsFilter(playbook_run_id);
    const rhcRuns = await dispatcher.fetchPlaybookRuns(filter, RUNSFIELDS);

    return rhcRuns;
};

exports.getRunHostDetails = async function (playbook_run_id, system_id) {
    const runsFilter = createDispatcherRunHostsFilter(playbook_run_id);
    const runHostsFilter = createDispatcherRunHostsFilter(playbook_run_id, system_id);
    const [rhcRunHosts, rhcRunHostDetails] = await Promise.all([
        dispatcher.fetchPlaybookRuns(runsFilter, RUNSFIELDS),
        dispatcher.fetchPlaybookRunHosts(runHostsFilter, RUNHOSTFIELDS)
    ]);

    if (!rhcRunHosts || !rhcRunHostDetails) {
        return null;
    }

    const host = _.find(rhcRunHosts.data, host => host.id === system_id);

    return formatRHCHostDetails(host, rhcRunHostDetails, playbook_run_id);
};

exports.combineHosts = function (rhcRunHosts, systems, playbook_run_id) {
    rhcRunHosts = exports.formatRunHosts(rhcRunHosts, playbook_run_id);

    _.forEach(rhcRunHosts, host => {
        pushRHCSystem(host, systems);
    });
};

exports.combineRuns = async function (remediation) {
    for (const run of remediation.playbook_runs) {
        const rhcRuns = await exports.getRHCRuns(run.id);

        if (rhcRuns) {
            formatRHCRuns(rhcRuns);
            pushRHCExecutor(rhcRuns, run);
        }
    }

    return remediation.playbook_runs;
};

async function fetchRHCClientId (systems) {
    const systemIds = _.map(systems, system => { return system.id; });
    const systemProfileDetails = await inventory.getSystemProfileBatch(systemIds);

    _.forEach(systems, system => {
        system.rhc_client = systemProfileDetails[system.id].system_profile.rhc_client_id;
        system.marketplace = systemProfileDetails[system.id].system_profile.is_marketplace;
    });
}

function sortRHCSystems (executor, smart_management) {
    if (smart_management) {
        return _.partition(executor.systems, system => !_.isUndefined(system.rhc_client));
    }

    const partitionedSystems = _.partition(executor.systems, system => !_.isUndefined(system.rhc_client) && system.marketplace);

    return partitionedSystems;
}

async function fetchSystems (ids) {
    const systemDetails = await inventory.getSystemDetailsBatch(ids, true);

    return _(ids).map(id => _.get(systemDetails, id)).filter().value();
}

exports.getSatelliteId = function (facts) {
    const satelliteFacts = _.find(facts, SATELLITE_NAMESPACE);

    if (satelliteFacts) {
        return satelliteFacts.facts.satellite_instance_id;
    }

    return null;
};

function defineRHCEnabledExecutor (satellites, smart_management, rhc_enabled) {
    const satlessExecutor = _.find(satellites, satellite => satellite.id === null);
    if (satlessExecutor) {
        const partitionedSystems = sortRHCSystems(satlessExecutor, smart_management);

        if (!_.isEmpty(partitionedSystems[0])) {
            satellites.push({id: null, systems: partitionedSystems[0], type: 'RHC', rhcStatus: (rhc_enabled) ? CONNECTED : DISABLED});
        }

        satlessExecutor.systems = partitionedSystems[1];

        if (!smart_management) {
            satlessExecutor.systems = _.filter(partitionedSystems[1], system => !_.isUndefined(system.rhc_client) && !system.marketplace);
            const noSmartManagement = _.filter(partitionedSystems[1], system => _.isUndefined(system.rhc_client) && !system.marketplace);
            if (!_.isEmpty(noSmartManagement)) {
                satellites.push({id: null, systems: noSmartManagement, type: 'RHC', rhcStatus: 'no_smart_management'});
            }

            const rhcNotConfigured = _.filter(partitionedSystems[1], system => _.isUndefined(system.rhc_client) && system.marketplace);
            if (!_.isEmpty(rhcNotConfigured)) {
                satellites.push({id: null, systems: rhcNotConfigured, type: 'RHC', rhcStatus: 'no_rhc'});
            }
        }
    }
}

function fetchRHCStatus (satellite) {
    if (satellite.type === 'RHC') {
        return satellite.rhcStatus;
    }

    return null;
}

function filterExecutors (status, excludes = null) {
    if (excludes) {
        // If any of the given excludes isn't in  throw error
        const unknownExcludes = _.difference(excludes, _.filter(excludes, exclude_id => {
            if (exclude_id === 'RHC') {
                return _.find(status, executor => executor.type === exclude_id);
            }

            return _.find(status, executor => executor.satId === exclude_id);
        }));

        if (!_.isEmpty(unknownExcludes)) {
            throw errors.unknownExclude(unknownExcludes);
        }

        probes.excludedExecutors(excludes);

        if (_.includes(excludes, 'RHC')) {
            status = _.filter(status, executor => executor.type !== 'RHC');
        }

        status = _.filter(status, executor => !_.includes(excludes, executor.satId));
    }

    // Only return executors with status "connected"
    return _.filter(status, {status: 'connected'});
}

function findResponseMode (response_mode, executors) {
    if (response_mode) {
        if (!['diff', 'full'].includes(response_mode)) {
            throw new errors.BadRequest('UNKNOWN_RESPONSEMODE', `Response Mode "${response_mode}" does not exist`);
        }

        return (response_mode === 'diff') ? DIFF_MODE : FULL_MODE;
    }

    if (config.fifi.text_update_full === DIFF_MODE) {
        if (_.size(executors) < 200) {
            return FULL_MODE;
        }

        return DIFF_MODE;
    }

    return config.fifi.text_update_full;
}

function findResponseInterval (executors) {
    if (config.fifi.text_update_full === DIFF_MODE) {
        // if in DIFF mode use dynamic config
        if (_.size(executors) < 200) {
            return 5000;
        } else if (_.size(executors) < 400) {
            return 30000;
        } else if (_.size(executors) >= 400) {
            return 60000;
        }
    }

    return config.fifi.text_update_interval;
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

function getStatus (executor, smart_management) {
    if (executor.type === 'satellite') {
        if (!smart_management) {
            return 'no_smart_management';
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
    } else if (executor.type === 'RHC') {
        if (executor.rhcStatus === 'no_smart_management') {
            return 'no_smart_management';
        }

        if (executor.rhcStatus === 'no_rhc') {
            return 'no_rhc';
        }

        if (executor.rhcStatus === 'disabled') {
            return 'disabled';
        }
    } else if (executor.type === null) {
        return 'no_executor';
    }

    return 'connected';
}

function defineExecutorType (executor) {
    // If executor type has been defined as RHC don't change it
    if (executor.type === 'RHC') {
        return 'RHC';
    }

    if (_.isUndefined(executor.type) && executor.id) {
        return 'satellite';
    }

    return null;
}

function normalize (satellites, smart_management) {
    return _.map(satellites, satellite => ({
        satId: satellite.id,
        receptorId: _.get(satellite.receptor, 'receptor_node', null),
        endpointId: _.get(satellite.receptor, 'id', null),
        systems: _.map(satellite.systems, system => _.pick(system, SYSTEM_FIELDS)),
        type: satellite.type,
        name: getName(satellite),
        status: getStatus(satellite, smart_management)
    }));
}

exports.getListSize = function (list) {
    return _.size(list);
};

exports.pagination = function (list, total, limit, offset) {
    if (offset >= Math.max(total, 1)) {
        return null;
    }

    list = list.slice(offset, offset + limit);

    return list;
};

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

exports.generateUuid = function () {
    return uuidv4();
};

exports.getConnectionStatus = async function (remediation, account, smart_management, rhc_enabled) {
    const systemsIds = _(remediation.issues).flatMap('systems').map('system_id').uniq().sort().value();
    const systems = await fetchSystems(systemsIds);

    _.forEach(systems, system => system.satelliteId = exports.getSatelliteId(system.facts));

    await fetchRHCClientId(systems);

    const satellites = _(systems).groupBy('satelliteId').mapValues(systems => ({
        id: systems[0].satelliteId,
        // unique by ansible host i.e. if there are two systems with the same ansible identifier then
        // only pick on one of them as we wouldn't be able to tell them apart based on responses from Satellite
        systems: _(systems).sortBy('id').uniqBy(generator.systemToHost).value()
    })).values().value();

    if (!_.isEmpty(satellites)) {
        defineRHCEnabledExecutor(satellites, smart_management, rhc_enabled);
    }

    if (smart_management) {
        const sourceInfo = await sources.getSourceInfo(_(satellites).map('id').filter().value());

        _.forEach(satellites, satellite => {
            satellite.source = _.get(sourceInfo, satellite.id, null);
            satellite.receptor = getReceptor(satellite.source);
        });

        await P.map(satellites, async satellite => {
            satellite.receptorStatus = await fetchReceptorStatus(satellite.receptor, account);
        });
    }

    _.forEach(satellites, satellite => {
        satellite.type = defineExecutorType(satellite); // defines all executors not marked with "RHC" as satellite type
        satellite.rhcStatus = fetchRHCStatus(satellite);
    });

    return normalize(satellites, smart_management);
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

// prepare everything that we need to dispatch work requests to receptor
async function prepareReceptorRequest (
    executor,
    remediation,
    remediationIssues,
    playbook_run_id,
    text_update_full,
    text_update_interval) {

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
        playbook_run_id,
        text_update_full,
        text_update_interval), remediation.account_number, executor.receptorId);

    return { executor, receptorWorkRequest, playbook};
}

// prepare everything needed to dispatch work requests to RHC
function prepareRHCRequest (executor, playbook_run_id, remediation) {
    const rhcWorkRequest = _.map(executor.systems, system => {
        return format.rhcWorkRequest(
            system.rhc_client,
            remediation.account_number,
            remediation.id,
            system.id,
            playbook_run_id);
    });

    return { executor, rhcWorkRequest };
}

function dispatchReceptorRequests (requests, remediation, playbook_run_id) {
    return P.mapSeries(requests, async ({ executor, receptorWorkRequest }, index) => {
        try {
            probes.splitPlaybookPerSatId(receptorWorkRequest, executor.satId, remediation, playbook_run_id);
            const response = await receptorConnector.postInitialRequest(receptorWorkRequest);
            probes.receptorJobDispatched(receptorWorkRequest, executor, response, remediation, playbook_run_id);
            return response;
        } catch (e) {
            if (index !== 0) {
                log.error({executor: executor.id, error: e}, 'error sending Playbook to executor');
                return null;
            }

            throw e;
        }
    });
}

function prepareCancelRequest (account_number, executor, playbook_run_id) {
    const receptorCancelRequest = format.receptorCancelRequest(format.playbookCancelRequest(
        playbook_run_id), account_number, executor.get('receptor_node_id'));

    return { executor, receptorCancelRequest };
}

function dispatchCancelRequests (requests, playbook_run_id) {
    return P.mapSeries(requests, async ({ executor, receptorCancelRequest }) => {
        try {
            const response = await receptorConnector.postInitialRequest(receptorCancelRequest);
            probes.receptorCancelDispatched(receptorCancelRequest, executor, response, playbook_run_id);
            return response;
        } catch (e) {
            log.error({executor: executor.id, error: e}, 'error sending cancel request to executor');
        }
    });
}

async function dispatchRHCRequests ({executor, rhcWorkRequest}, playbook_run_id) {
    try {
        probes.splitPlaybookPerRHCEnabledSystems(rhcWorkRequest, executor.systems, playbook_run_id);
        const response = await dispatcher.postPlaybookRunRequests(rhcWorkRequest);
        probes.rhcJobDispatched(rhcWorkRequest, executor, response, playbook_run_id);
        return response;
    } catch (e) {
        log.error({systems: executor.systems, error: e}, 'error sending work request to playbook-dispatcher');
    }
}

async function storePlaybookRun (remediation, playbook_run_id, requests, responses, username, text_update_full) {
    requests.forEach(({executor}, index) => {
        executor.id = uuidv4();
        // eslint-disable-next-line security/detect-object-injection
        executor.response = responses[index];
        // eslint-disable-next-line security/detect-object-injection
        executor.dispatched = (responses[index] !== null);
    });

    const run = {
        id: playbook_run_id,
        remediation_id: remediation.id,
        created_by: username
    };

    const executors = requests.map(({executor, playbook}) => ({
        id: executor.id,
        executor_id: executor.satId,
        executor_name: executor.name,
        receptor_node_id: executor.receptorId,
        status: executor.dispatched ? PENDING : FAILURE,
        // null means we wanted to run this but dispatching of the receptor-controller job request failed
        // we still record the entry but mark the executor and systems as FAILURE instantly
        receptor_job_id: executor.dispatched ? executor.response.id : null,
        playbook: playbook.yaml,
        text_update_full,
        playbook_run_id
    }));

    const systems = _.flatMap(requests, ({executor}) => executor.systems.map(system => ({
        id: uuidv4(),
        system_id: system.id,
        system_name: generator.systemToHost(system),
        status: executor.dispatched ? PENDING : FAILURE,
        playbook_run_executor_id: executor.id
    })));

    await queries.insertPlaybookRun(run, executors, systems);
}

async function storeRHCPlaybookRun (remediation, playbook_run_id, username) {
    const run = {
        id: playbook_run_id,
        remediation_id: remediation.id,
        created_by: username
    };

    await queries.insertRHCPlaybookRun(run);
}

exports.createPlaybookRun = async function (status, remediation, username, excludes, response_mode) {
    const playbook_run_id = exports.generateUuid();
    const executors = filterExecutors(status, excludes);
    const remediationIssues = remediation.toJSON().issues;
    const text_update_full = findResponseMode(response_mode, executors);
    const text_update_interval = findResponseInterval(executors);

    if (_.isEmpty(executors)) {
        return null;
    }

    const requests = await P.map(executors,
        executor => {
            if (executor.type === 'satellite') {
                return prepareReceptorRequest(
                    executor,
                    remediation,
                    remediationIssues,
                    playbook_run_id,
                    text_update_full,
                    text_update_interval);
            }

            if (executor.type === 'RHC') {
                return prepareRHCRequest(
                    executor,
                    playbook_run_id,
                    remediation,
                );
            }
        }
    );

    // split requests by type
    const splitRequests = _.groupBy(requests, 'executor.type');

    // Dispatch satellite requests if they exist
    if (splitRequests.satellite) {
        const satelliteRequests = splitRequests.satellite;
        const receptorResponses = await dispatchReceptorRequests(satelliteRequests, remediation, playbook_run_id);

        await storePlaybookRun(remediation, playbook_run_id, satelliteRequests, receptorResponses, username, text_update_full);
    }

    // Dispatch RHC requests if they exist
    if (splitRequests.RHC) {
        const rhcRequests = splitRequests.RHC[0]; // There should only ever be one
        await dispatchRHCRequests(rhcRequests, playbook_run_id);

        if (_.isEmpty(splitRequests.satellite)) {
            await storeRHCPlaybookRun(remediation, playbook_run_id, username);
        }
    }

    return playbook_run_id;
};

exports.cancelPlaybookRun = async function (account_number, playbook_run_id, executors) {
    const requests = executors.map(executor => prepareCancelRequest(account_number, executor, playbook_run_id));

    await dispatchCancelRequests(requests, playbook_run_id);
};

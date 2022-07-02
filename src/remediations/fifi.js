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
const MIN_SAT_RHC_VERSION = [6, 11, 0];
const SYSTEM_FIELDS = Object.freeze(['id', 'ansible_host', 'hostname', 'display_name', 'rhc_client']);

const RUNSFIELDS = Object.freeze({fields: {data: ['id', 'labels', 'status', 'service', 'created_at', 'updated_at', 'url']}});
const RUNHOSTFIELDS = Object.freeze({fields: {data: ['stdout', 'inventory_id']}});
const RHCRUNFIELDS = Object.freeze({fields: {data: ['host', 'status', 'inventory_id']}});
const RHCSTATUSES = ['timeout', 'failure', 'success', 'running'];

const DIFF_MODE = false;
const FULL_MODE = true;

const CONNECTED = 'connected';
const DISCONNECTED = 'disconnected';
const DISABLED = 'disabled';
const PENDING = 'pending';
const FAILURE = 'failure';
const RUNNING = 'running';
const SUCCESS = 'success';
const CANCELED = 'canceled';
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

function findPlaybookRunStatus (run) {
    if (_.some(run.executors, executor => executor.status === FAILURE)) {
        return FAILURE;
    }

    if (_.some(run.executors, executor => executor.status === CANCELED)) {
        return CANCELED;
    }

    if (_.every(run.executors, executor => executor.status === PENDING)) {
        return PENDING;
    }

    if (_.every(run.executors, executor => executor.status === SUCCESS)) {
        return SUCCESS;
    }

    return RUNNING;
}

// TODO: Replace this logic with logic in the remediations-consumer
exports.updatePlaybookRunsStatus = function (playbook_runs) {
    _.forEach(playbook_runs, run => {
        run.status = findPlaybookRunStatus(run);
    });
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

function createDispatcherRunHostsFilter (playbook_run_id, run_id = null, system_id = null) {
    const runHostsFilter = {filter: {run: {}}};
    runHostsFilter.filter.run.service = SERVICE;
    runHostsFilter.filter.run.labels = {'playbook-run': playbook_run_id};

    if (run_id) {
        runHostsFilter.filter.run.id = run_id;
    }

    if (system_id) {
        runHostsFilter.filter.inventory_id = system_id;
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

// Create array of maps: one representing all RCH-direct hosts, and one for each RHC-satellite
// Compute aggregate system_count, status counts and overall status for each
async function formatRHCRuns (rhcRuns, playbook_run_id) {
    // rhcRuns contains all the dispatcher runs for this playbook_run_id
    // One for each RHC-(satellite, org), one for each RHC-direct host

    let executors = [];

    let rhcDirect = {
        name: 'Direct connected',
        executor_id: playbook_run_id,
        status: null,
        system_count: 0,
        playbook_run_id: playbook_run_id,
        playbook: null,
        updated_at: null,
        count_timeout: 0,
        count_failure: 0,
        count_success: 0,
        count_running: 0,
    }
    
    for (const run of rhcRuns.data) {
        // get dispatcher run hosts
        const runHostsFilter = createDispatcherRunHostsFilter(run.labels['playbook-run'], run.id);
        const rhcRunHosts = await dispatcher.fetchPlaybookRunHosts(runHostsFilter, RHCRUNFIELDS);

        // If host === 'localhost' then add to RHCDirect
        if (_.get(rhcRunHosts, 'data[0][host]') === 'localhost') {
            rhcDirect.playbook = run.url;
            rhcDirect.updated_at = run.updated_at;
            rhcDirect.system_count += rhcRunHosts.meta.count; // should always be 1, but...
            rhcDirect[`count_${run.status}`]++;
        }

        // else create a new sat executor
        else {
            let satExecutor = {
                name: 'RHC Satellite',
                executor_id: playbook_run_id,
                status: null,
                system_count: rhcRunHosts.meta.count,
                playbook_run_id: playbook_run_id,
                playbook: run.url,
                updated_at: run.updated_at,
                count_timeout: 0,
                count_failure: 0,
                count_success: 0,
                count_running: 0,
            };

            // Assign each status count
            RHCSTATUSES.forEach(status => {
                satExecutor[`count_${status}`] = _.size(_.filter(rhcRunHosts.data, run => run.status === status));
            });

            // timeouts also count as errors since count_timeout doesn't get propogated
            satExecutor.count_failure += satExecutor.count_timeout;

            // Compute status of executor
            satExecutor.status = findRunStatus(satExecutor);

            executors.push(satExecutor);
        }
    }

    // return array of executors
    if (rhcDirect.system_count > 0) {
        // Status of executor
        rhcDirect.status = findRunStatus(rhcDirect);
        executors.push(rhcDirect);
    }

    return executors;
}


exports.formatRunHosts = async function (rhcRuns, playbook_run_id) {
    let hosts = [];

    for (const run of rhcRuns.data) {
        // get dispatcher run hosts...
        const runHostsFilter = createDispatcherRunHostsFilter(playbook_run_id, run.id);
        const rhcRunHosts = await dispatcher.fetchPlaybookRunHosts(runHostsFilter, RHCRUNFIELDS);

        hosts.push( ... _.map(rhcRunHosts.data, host => ({
            system_id: run.id,  // should be host.inventory_id?
            system_name: host.host,
            status: (host.status === 'timeout' ? 'failure' : host.status),
            updated_at: run.updated_at,
            playbook_run_executor_id: playbook_run_id
        })));
    }

    return hosts;
};

function formatRHCHostDetails (host, details, playbook_run_id) {
    return {
        system_id: host.id,
        system_name: details.data[0].inventory_id,
        status: (host.status === 'timeout' ? 'failure' : host.status),
        updated_at: host.updated_at,
        console: details.data[0].stdout,
        executor_id: playbook_run_id
    };
}

function pushRHCSystem (host, systems) {
    systems.push(host);
}

function pushRHCExecutor (rhcRuns, satRun) {
    for (const rhcRun of rhcRuns) {
        satRun.executors.push({
            executor_id: rhcRun.executor_id,
            executor_name: rhcRun.name,
            status: rhcRun.status,
            system_count: rhcRun.system_count,
            playbook_run_id: rhcRun.playbook_run_id,
            playbook: rhcRun.playbook,
            updated_at: rhcRun.updated_at,
            count_failure: rhcRun.count_failure,
            count_success: rhcRun.count_success,
            count_running: rhcRun.count_running,
            count_pending: 0, // RHC does not return the status pending
            count_canceled: 0 // RHC does not currently return status canceled
        });
    }
}

function checkSatVersionForRhc (version) {
    if (_.isNull(version)) {
        return false;
    }

    const versionToInt = _.map(_.split(version, '.'), _.parseInt);

    if (versionToInt[1] > MIN_SAT_RHC_VERSION[1]) {
        return true;
    }

    if (versionToInt[1] === MIN_SAT_RHC_VERSION[1] && versionToInt[2] >= MIN_SAT_RHC_VERSION[2]) {
        return true;
    }

    return false;
}

exports.getRHCRuns = async function (playbook_run_id = null) {
    const filter = createDispatcherRunsFilter(playbook_run_id);
    const rhcRuns = await dispatcher.fetchPlaybookRuns(filter, RUNSFIELDS);

    return rhcRuns;
};

exports.getRunHostDetails = async function (playbook_run_id, system_id) {
    // So... given the remediations playbook_run_id and a system_id find the matching
    // dispatcher run_hosts entry.  /dispatcher/runs?playbook_run_id will return an
    // entry for every RHC-direct host that was part of the playbook run, and one for
    // each <satellite,org> with one or more systems.  We need the *dispatcher* run_id
    // and the system_id to query dispatcher run_hosts...

    const runsFilter = createDispatcherRunsFilter(playbook_run_id);
    const rhcRuns = await dispatcher.fetchPlaybookRuns(runsFilter, RUNSFIELDS);

    if (!rhcRuns || !rhcRuns.data) {
        return null; // didn't find any dispatcher runs for playbook_run_id...
    }

    // For each dispatcher run in rhcRuns
    //   get run_hosts for this run_id and system_id
    //   return the first match found

    for (const run of rhcRuns.data) {
        const runHostsFilter = createDispatcherRunHostsFilter(playbook_run_id, run.id, system_id);
        const rhcRunHosts = await dispatcher.fetchPlaybookRunHosts(runHostsFilter, RUNHOSTFIELDS)

        if (!rhcRunHosts || !rhcRunHosts.data) {
            return null; // didn't find any runHosts for dispatcher_run_id + system_id...
        }

        if (rhcRunHosts.data) {
            // there should only ever be one run_hosts entry for a given system_id in a
            // dispatcher run, right?  Just grab the first entry...
            return formatRHCHostDetails(run, rhcRunHosts, playbook_run_id);
        }
    }

    return null; // didn't find any systems...
};

exports.combineHosts = async function (rhcRunHosts, systems, playbook_run_id) {
    rhcRunHosts = await exports.formatRunHosts(rhcRunHosts, playbook_run_id);

    _.forEach(rhcRunHosts, host => {
        pushRHCSystem(host, systems);
    });
};

// add rhc playbook run data to remediation
exports.combineRuns = async function (remediation) {
    // array of playbook_run_id
    for (const run of remediation.playbook_runs) {
        // query playbook-dispatcher to see if there are any RHC direct or
        // RHC satellite hosts for this playbook run...
        const rhcRuns = await exports.getRHCRuns(run.id); // run.id is playbook_run_id

        if (rhcRuns) {
            const executors = await formatRHCRuns(rhcRuns, run.id);
            pushRHCExecutor(executors, run);
        }
    }

    return remediation.playbook_runs;
};

async function fetchRHCClientId (systems, systemIds) {
    const systemProfileDetails = await inventory.getSystemProfileBatch(systemIds);

    _.forEach(systems, system => {
        system.rhc_client = systemProfileDetails[system.id].system_profile.rhc_client_id;
        system.marketplace = systemProfileDetails[system.id].system_profile.is_marketplace;
    });
}

async function fetchSatRHCClientId (systems) {
    await P.map(systems, async system => {
        if (checkSatVersionForRhc(system.satelliteVersion) && !_.isNull(system.satelliteId)) {
            const sourcesDetails = await sources.getSourceInfo([system.satelliteId]);
            const id = _(sourcesDetails).get([system.satelliteId, 'id']);
            const sourcesRHCDetails = await sources.getRHCConnections(id);

            log.info({sourcesDetails: sourcesDetails}, 'sourcesDetails');
            log.info({sourcesRHCDetails: sourcesRHCDetails}, 'sourcesRHCDetails');

            if (sourcesRHCDetails) {
                system.sat_rhc_client = (sourcesRHCDetails[0].availability_status === "available") ? sourcesRHCDetails[0].rhc_id : null;
            } else {
                system.sat_rhc_client = null;
            }
        } else {
            system.sat_rhc_client = null;
        }
    });
}

async function defineDirectConnectedRHCSystems (executor, smart_management, org_id) {
    let rhcSystems = [];
    if (smart_management) {
        rhcSystems = _.partition(executor.systems, system => !_.isUndefined(system.rhc_client));
    } else {
        rhcSystems = _.partition(executor.systems, system => !_.isUndefined(system.rhc_client) && system.marketplace);
    }

    // If there are no systems to check, return rhcSystems
    if (_.isEmpty(rhcSystems[0])) {
        return rhcSystems;
    }

    const dispatcherStatusRequest = _.map(rhcSystems[0], system => { return {recipient: system.rhc_client, org_id: String(org_id) }; });
    const requestStatuses = await dispatcher.getPlaybookRunRecipientStatus(dispatcherStatusRequest);

    // partition systems containing rhc_client_ids by connection status
    _.forEach(rhcSystems[0], system => {
        if (!_.isNull(requestStatuses)) {
            if (requestStatuses[system.rhc_client]) {
                system.rhcStatus = requestStatuses[system.rhc_client].connected;
            } else {
                system.rhcStatus = false;
            }
        } else {
            system.rhcStatus = false;
        }
    });
    rhcSystems[0] = _.partition(rhcSystems[0], system => system.rhcStatus === true);

    return rhcSystems;
}

async function fetchSystems (ids) {
    const systemDetails = await inventory.getSystemDetailsBatch(ids, true);

    return _(ids).map(id => _.get(systemDetails, id)).filter().value();
}

function getSatelliteFacts (facts) {
    const parsedFacts = { satelliteId: null, satelliteOrgId: null, satelliteVersion: null };
    const satelliteFacts = _.find(facts, SATELLITE_NAMESPACE);

    if (satelliteFacts) {
        parsedFacts.satelliteId = satelliteFacts.facts.satellite_instance_id;
        parsedFacts.satelliteOrgId = satelliteFacts.facts.organization_id;
        parsedFacts. satelliteVersion = satelliteFacts.facts.satellite_version;
    }

    return parsedFacts;
}

async function defineRHCEnabledExecutor (satellites, smart_management, rhc_enabled, org_id) {
    const satlessExecutor = _.find(satellites, satellite => satellite.id === null);
    if (satlessExecutor) {
        const partitionedSystems = await defineDirectConnectedRHCSystems(satlessExecutor, smart_management, org_id);
        _.remove(satellites, executor => executor === satlessExecutor); // Remove redundant satless executor

        if (!_.isEmpty(partitionedSystems[0])) {
            if (!_.isEmpty(partitionedSystems[0][0])) {
                satellites.push({id: null, systems: partitionedSystems[0][0], type: 'RHC', rhcStatus: (rhc_enabled) ? CONNECTED : DISABLED});
            }

            if (!_.isEmpty(partitionedSystems[0][1])) {
                satellites.push({id: null, systems: partitionedSystems[0][1], type: 'RHC', rhcStatus: (rhc_enabled) ? DISCONNECTED : DISABLED});
            }
        }

        if (!smart_management) {
            const noSmartManagement = _.filter(partitionedSystems[1], system => !system.marketplace);
            if (!_.isEmpty(noSmartManagement)) {
                satellites.push({id: null, systems: noSmartManagement, type: 'RHC', rhcStatus: 'no_smart_management'});
            }

            const rhcNotConfigured = _.filter(partitionedSystems[1], system => _.isUndefined(system.rhc_client) && system.marketplace);
            if (!_.isEmpty(rhcNotConfigured)) {
                satellites.push({id: null, systems: rhcNotConfigured, type: 'RHC', rhcStatus: 'no_rhc'});
            }
        } else {
            const rhcNotConfigured = _.filter(partitionedSystems[1], system => _.isUndefined(system.rhc_client));
            if (!_.isEmpty(rhcNotConfigured)) {
                satellites.push({id: null, systems: rhcNotConfigured, type: 'RHC', rhcStatus: 'no_rhc'});
            }
        }
    }
}

async function fetchRHCStatuses (satellites, org_id) {
    const recipientStatusRequest = _.map(satellites, satellite => {
        return {
            recipient: satellite.sat_rhc_client,
            org_id: String(org_id)
        };
    });

    const result = await dispatcher.getPlaybookRunRecipientStatus(recipientStatusRequest);
    log.info({results: result}, 'playbook-dispatcher-results');

    _.forEach(satellites, satellite => {
        if (result) {
            satellite.rhcStatus = (result[satellite.sat_rhc_client].connected) ? CONNECTED : DISCONNECTED;
        } else {
            satellite.rhcStatus = null;
        }
    });
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
    if (executor.source && executor.type === 'satellite') {
        return executor.source.name;
    }

    if (executor.id) {
        return `Satellite ${executor.id} Org ${executor.org_id}`;
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

        if (executor.receptorStatus !== CONNECTED) {
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
    } else if (executor.type === 'RHC-satellite') {
        if (executor.rhcStatus !== 'connected') {
            return 'disconnected'
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
        satOrgId: satellite.org_id,
        satRhcId: satellite.sat_rhc_client,
        receptorId: _.get(satellite.receptor, 'receptor_node', null),
        endpointId: _.get(satellite.receptor, 'id', null),
        systems: _.map(satellite.systems, system => _.pick(system, SYSTEM_FIELDS)),
        type: satellite.type,
        name: getName(satellite),
        status: getStatus(satellite, smart_management)
    }));
}

async function prepareReceptorSatellites(satellites, account) {
    const sourceInfo = await sources.getSourceInfo(_(satellites).map('id').filter().value());

    _.forEach(satellites, satellite => {
        satellite.source = _.get(sourceInfo, satellite.id, null);
        satellite.receptor = getReceptor(satellite.source);
    });

    await P.map(satellites, async satellite => {
        satellite.receptorStatus = await fetchReceptorStatus(satellite.receptor, account);
    });
}

async function defineRHCSatellites(systems, org_id) {
    const rhcSatellites = _(systems)
    .groupBy((system) => `${system.satelliteId}+${system.satelliteOrgId}`)
    .mapValues(systems => ({
        id: systems[0].satelliteId,
        org_id: systems[0].satelliteOrgId,
        version: systems[0].satelliteVersion,
        sat_rhc_client: systems[0].sat_rhc_client,
        type: 'RHC-satellite',
        // unique by ansible host i.e. if there are two systems with the same ansible identifier then
        // only pick on one of them as we wouldn't be able to tell them apart based on responses from Satellite
        systems: _(systems).sortBy('id').uniqBy(generator.systemToHost).value()
    })).values().value();

    await fetchRHCStatuses(rhcSatellites, org_id);

    return rhcSatellites;
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

exports.getConnectionStatus = async function (remediation, account, org_id, smart_management, rhc_enabled) {
    // get list of system_ids
    // fetch system details for each system_id -> systems[]
    // get (sat_id, sat_org_id, sat_version) for each receptor satellite
    // get rhc_client_id for each rhc system
    // get sat_rhc_client (rhc_id) for rhc satellites
    const systemsIds = _(remediation.issues).flatMap('systems').map('system_id').uniq().sort().value();
    const systems = await fetchSystems(systemsIds);

    await P.map(systems, async system => {
        const satelliteFacts = await getSatelliteFacts(system.facts);
        system.satelliteId = satelliteFacts.satelliteId;
        system.satelliteOrgId = satelliteFacts.satelliteOrgId;
        system.satelliteVersion = satelliteFacts.satelliteVersion;
    });

    await fetchRHCClientId(systems, systemsIds);
    await fetchSatRHCClientId(systems);
    const [rhcSatelliteSystems, receptorSatelliteSystems] = _.partition(systems, system => { return !_.isNull(system.sat_rhc_client); });
    const receptorSatellites = _(receptorSatelliteSystems).groupBy('satelliteId').mapValues(receptorSatelliteSystems => ({
        id: receptorSatelliteSystems[0].satelliteId,
        org_id: receptorSatelliteSystems[0].satelliteOrgId,
        version: receptorSatelliteSystems[0].satelliteVersion,
        // unique by ansible host i.e. if there are two systems with the same ansible identifier then
        // only pick on one of them as we wouldn't be able to tell them apart based on responses from Satellite
        systems: _(receptorSatelliteSystems).sortBy('id').uniqBy(generator.systemToHost).value()
    })).values().value();

    let rhcSatellites = [];
    if (!_.isEmpty(rhcSatelliteSystems)) {
        rhcSatellites = await defineRHCSatellites(rhcSatelliteSystems, org_id);
    }

    if (!_.isEmpty(receptorSatellites)) {
        await defineRHCEnabledExecutor(receptorSatellites, smart_management, rhc_enabled, org_id);
    }

    if (smart_management) {
        await prepareReceptorSatellites(receptorSatellites, account);
    }

    _.forEach(receptorSatellites, async satellite => {
        satellite.type = defineExecutorType(satellite);
    });

    const concatSatellites = _.concat(rhcSatellites, receptorSatellites);

    // this seems to ommit sat_rhc_client :-/ ...
    return normalize(concatSatellites, smart_management);
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

// prepare everything needed to dispatch work requests to satellite via RHC
function prepareRHCSatelliteRequest (executor, remediation, username, tenant_org_id, playbook_run_id) {
    const rhcSatWorkRequest = format.rhcSatelliteWorkRequest(
        executor,
        remediation,
        username,
        tenant_org_id,
        playbook_run_id);

    return { executor,  rhcSatWorkRequest };
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

async function dispatchRHCSatelliteRequests (rhcSatWorkRequest, playbook_run_id) {
    try {
        const workRequest = _(rhcSatWorkRequest).map('rhcSatWorkRequest').value();
        probes.splitPlaybookPerRHCEnabledSatellite(rhcSatWorkRequest, playbook_run_id);
        const response = await dispatcher.postV2PlaybookRunRequests(workRequest);
        probes.rhcSatJobDispatched(rhcSatWorkRequest, response, playbook_run_id);
        return response;
    } catch (e) {
        log.error({workRequest: rhcSatWorkRequest, error: e}, 'error sending satellite work request to playbook-dispatcher');
    }
}

function prepareReceptorCancelRequest (account_number, executor, playbook_run_id) {
    const receptorCancelRequest = format.receptorCancelRequest(format.playbookCancelRequest(
        playbook_run_id), account_number, executor.get('receptor_node_id'));

    return { executor, receptorCancelRequest };
}

function prepareRHCCancelRequest (org_id, playbook_run_id, username) {
    return { run_id: playbook_run_id, org_id, principal: username};
}

function dispatchReceptorCancelRequests (requests, playbook_run_id) {
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

async function dispatchRHCCancelRequests (dispatcherCancelRequest, playbook_run_id) {
    try {
        const response = await dispatcher.postPlaybookCancelRequest(dispatcherCancelRequest);
        probes.dispatcherCancelDispatched(dispatcherCancelRequest);
        return response;
    } catch (e) {
        log.error({playbook_run_id, error: e}, 'error sending cancel request to playbook-dispatcher');
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

exports.createPlaybookRun = async function (status, remediation, username, tenant_org_id, excludes, response_mode) {
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
            // satellite via receptor
            if (executor.type === 'satellite') {
                return prepareReceptorRequest(
                    executor,
                    remediation,
                    remediationIssues,
                    playbook_run_id,
                    text_update_full,
                    text_update_interval);
            }

            // satellite via cloud connector
            if (executor.type === 'RHC-satellite') {
                return prepareRHCSatelliteRequest(
                    executor,
                    remediation,
                    username,
                    tenant_org_id,
                    playbook_run_id
                )
            }

            // RHEL systems via cloud connector
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

    // Dispatch satellite via RHC if they exist
    if (splitRequests['RHC-satellite']) {
        const rhcSatRequests = splitRequests['RHC-satellite'];
        await dispatchRHCSatelliteRequests(rhcSatRequests, playbook_run_id);

        // this is gross - we should restructure this chain of logic...
        // basically, adds an entry if one hasn't been added already
        if (_.isEmpty(splitRequests.satellite) && _.isEmpty(splitRequests.RHC)) {
            await storeRHCPlaybookRun(remediation, playbook_run_id, username);
        }
    }

    return playbook_run_id;
};

exports.cancelPlaybookRun = async function (account_number, org_id, playbook_run_id, username, executors) {
    if (_.isEmpty(executors)) {
        const request = [prepareRHCCancelRequest(org_id, playbook_run_id, username)];
        await dispatchRHCCancelRequests(request);
    } else {
        const requests = executors.map(executor => prepareReceptorCancelRequest(account_number, executor, playbook_run_id));
        await dispatchReceptorCancelRequests(requests, playbook_run_id);
    }
};

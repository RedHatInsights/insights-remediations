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
const trace = require('../util/trace');
const cls = require("../util/cls");
const queries = require('./remediations.queries');

const probes = require('../probes');
const read = require('./controller.read');
const {rhcSatJobDispatched} = require("../probes");

const SATELLITE_NAMESPACE = Object.freeze({namespace: 'satellite'});
const MIN_SAT_RHC_VERSION = [6, 11, 0];
const SYSTEM_FIELDS = Object.freeze(['id', 'ansible_host', 'hostname', 'display_name', 'rhc_client']);

const RUNSFIELDS = Object.freeze({fields: {data: ['id', 'labels', 'status', 'service', 'created_at', 'updated_at', 'url']}});
const RUNHOSTFIELDS = Object.freeze({fields: {data: ['host', 'stdout', 'inventory_id']}});
const RHCRUNFIELDS = Object.freeze({fields: {data: ['host', 'status', 'inventory_id']}});
const RHCSTATUSES = ['timeout', 'failure', 'success', 'running', 'canceled'];

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

exports.findRunStatus = function (run) {
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
async function formatRHCRuns (dispatcherRuns, playbook_run_id) {
    trace.enter('fifi.js[formatRHCRuns]');

    // dispatcherRuns contains all the dispatcher runs for this playbook_run_id
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
        count_canceled: 0
    }

    trace.event(`processing ${dispatcherRuns.data.length} runs...`);

    for (const run of dispatcherRuns.data) {
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
        else if (!_.isEmpty(rhcRunHosts)) {
            let satExecutor = {
                name: 'RHC Satellite',
                executor_id: run.id,
                status: null,
                system_count: rhcRunHosts.meta.count,
                playbook_run_id: playbook_run_id,
                playbook: run.url,
                updated_at: run.updated_at,
                count_timeout: 0,
                count_failure: 0,
                count_success: 0,
                count_running: 0,
                count_canceled: 0
            };

            // Assign each status count
            RHCSTATUSES.forEach(status => {
                satExecutor[`count_${status}`] = _.size(_.filter(rhcRunHosts.data, run => run.status === status));
            });

            // timeouts also count as errors since count_timeout doesn't get propogated
            satExecutor.count_failure += satExecutor.count_timeout;

            // Compute status of executor
            satExecutor.status = exports.findRunStatus(satExecutor);

            executors.push(satExecutor);
        }
    }

    // return array of executors
    if (rhcDirect.system_count > 0) {
        // timeouts also count as errors since count_timeout doesn't get propogated
        rhcDirect.count_failure += rhcDirect.count_timeout;

        // Status of executor
        rhcDirect.status = exports.findRunStatus(rhcDirect);
        executors.push(rhcDirect);
    }

    trace.leave();
    return executors;
}


/**
 * Format RHC (Red Hat Connect) run hosts data by fetching proper system names (display_name || hostname)
 * from the systems table and combining with dispatcher run host information.
 * 
 * @param {Object} dispatcherRuns - Dispatcher runs data for this playbook run
 * @param {string} playbook_run_id - The playbook run ID
 * @returns {Array} Array of formatted host objects with system details
 * 
 * @example
 * // Returns array of host objects like:
 * [
 *   {
 *     system_id: "f6b7a1c2-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
 *     system_name: "Server 1", // fetched from systems table (display_name || hostname)
 *     status: "success", // 'timeout' mapped to 'failure'
 *     updated_at: "2023-10-01T12:00:00.000Z",
 *     // For direct systems, executor id is the remediation playbook_run_id
 *     playbook_run_executor_id: "<playbook_run_id>",
 *     executor_type: "direct"
 *   },
 *   {
 *     system_id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d", 
 *     system_name: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d", // fallback to UUID when system not found
 *     status: "running",
 *     updated_at: "2023-10-01T12:30:00.000Z", 
 *     // For satellite systems, executor id is the dispatcher run id
 *     playbook_run_executor_id: "<dispatcher_run_id>",
 *     executor_type: "satellite"
 *   }
 * ]
 */
exports.formatRunHosts = async function (dispatcherRuns, playbook_run_id) {
    let hosts = [];

    if (dispatcherRuns?.data) {
        // Collect all inventory IDs to fetch system details in batch
        const allInventoryIds = [];
        const allHosts = [];

        for (const run of dispatcherRuns.data) {
            // get dispatcher run hosts...
            const runHostsFilter = createDispatcherRunHostsFilter(playbook_run_id, run.id);
            const rhcRunHosts = await dispatcher.fetchPlaybookRunHosts(runHostsFilter, RHCRUNFIELDS);

            // Collect hosts and inventory IDs for batch processing
            for (const host of rhcRunHosts.data) {
                allInventoryIds.push(host.inventory_id);
                allHosts.push({
                    host,
                    run,
                    playbook_run_id
                });
            }
        }

        // Fetch system details for all inventory IDs in batch
        const systemDetails = await queries.getPlanSystemsDetails(allInventoryIds);

        // Format hosts with proper system names
        hosts = allHosts.map(({ host, run, playbook_run_id }) => {
            const details = systemDetails[host.inventory_id];
            // Use display_name if available, fallback to hostname, then to host.host
            const systemName = details?.display_name || details?.hostname || host.host;
            const isDirect = (host.host === 'localhost');
            return {
                system_id: host.inventory_id,
                system_name: systemName,
                status: (host.status === 'timeout' ? 'failure' : host.status),
                updated_at: run.updated_at,
                playbook_run_executor_id: isDirect ? playbook_run_id : run.id,
                executor_type: isDirect ? 'direct' : 'satellite'
            };
        });
    }

    return hosts;
};

/**
 * Format individual RHC host details by fetching proper system name (display_name || hostname)
 * from the systems table and combining with dispatcher host console output.
 * 
 * @param {Object} host - Host status information from dispatcher
 * @param {Object} details - Host details with console output from dispatcher 
 * @param {string} playbook_run_id - The playbook run ID used as executor_id
 * @returns {Object} Formatted host detail object with system information
 * 
 * @example
 * // Returns single host detail object like:
 * {
 *   system_id: "f6b7a1c2-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
 *   system_name: "Server 1", // fetched from systems table (display_name || hostname) or fallback
 *   status: "success", // 'timeout' mapped to 'failure'  
 *   updated_at: "2023-10-01T12:00:00.000Z",
 *   console: "Ansible playbook execution logs...",
 *   executor_id: "executor-uuid"
 * }
 */
exports.formatRHCHostDetails = async function formatRHCHostDetails (host, details, playbook_run_id) {
    const inventoryId = details.data[0].inventory_id;
    
    // Fetch system details to get proper hostname
    const systemDetails = await queries.getPlanSystemsDetails([inventoryId]);
    const systemInfo = systemDetails[inventoryId];
    
    // Use display_name if available, fallback to hostname, then to dispatcher host
    const systemName = systemInfo?.display_name || systemInfo?.hostname || details.data[0].host;
    
    return {
        system_id: inventoryId,
        system_name: systemName,
        status: (host.status === 'timeout' ? 'failure' : host.status),
        updated_at: host.updated_at,
        console: details.data[0].stdout,
        executor_id: playbook_run_id
    };
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
            count_canceled: rhcRun.count_canceled
        });
    }
}

exports.getRHCRuns = async function (playbook_run_id = null) {
    const filter = createDispatcherRunsFilter(playbook_run_id);
    const rhcRuns = await dispatcher.fetchPlaybookRuns(filter, RUNSFIELDS);

    return rhcRuns;
};

exports.getRunHostDetails = async function (playbook_run_id, system_id) {
    trace.enter('fifi.getRunHostDetails');
    // So... given the remediations playbook_run_id and a system_id find the matching
    // dispatcher run_hosts entry.  /dispatcher/runs?playbook_run_id will return an
    // entry for every RHC-direct host that was part of the playbook run, and one for
    // each <satellite,org> with one or more systems.  We need the *dispatcher* run_id
    // and the system_id to query dispatcher run_hosts...

    const runsFilter = createDispatcherRunsFilter(playbook_run_id);
    trace.event(`fetch playbook-dispatcher/v1/runs with filter: ${JSON.stringify(runsFilter)}`);
    const rhcRuns = await dispatcher.fetchPlaybookRuns(runsFilter, RUNSFIELDS);
    trace.event(`playbook-dispatcher returned: ${JSON.stringify(rhcRuns)}`);

    if (!rhcRuns || !rhcRuns.data) {
        trace.leave('playbook-dispatcher returned nothing useful!');
        return null; // didn't find any dispatcher runs for playbook_run_id...
    }

    // TODO: Don't do this; it's really inefficient.  Determine the
    //  playbook-dispatcher run_id for this host/playbook run and fetch the
    //  results that way.

    // For each dispatcher run in rhcRuns
    //   get run_hosts for this run_id and system_id
    //   return the first match found

    for (const run of rhcRuns.data) {
        const runHostsFilter = createDispatcherRunHostsFilter(playbook_run_id, run.id, system_id);
        trace.event(`fetch playbook-dispatcher/v1/run_hosts with filter: ${JSON.stringify(runHostsFilter)}`);
        const rhcRunHosts = await dispatcher.fetchPlaybookRunHosts(runHostsFilter, RUNHOSTFIELDS)
        trace.event(`playbook-dispatcher/v1/run_hosts returned: ${JSON.stringify(rhcRunHosts)}`);

        if (!rhcRunHosts || !rhcRunHosts.data) {
            trace.event('No data for host in this run - continuing...');
            continue; // didn't find any runHosts for dispatcher_run_id + system_id...
        }

        if (rhcRunHosts.data) {
            // there should only ever be one run_hosts entry for a given system_id in a
            // dispatcher run, right?  Just grab the first entry...
            const result = await exports.formatRHCHostDetails(run, rhcRunHosts, playbook_run_id);
            trace.leave(`Found a match - returning: ${JSON.stringify(result)}`);
            return result;
        }
    }

    trace.leave('data for system not found');
    return null; // didn't find any systems...
};

exports.combineHosts = async function (rhcRunHosts, systems, playbook_run_id, filter_hostname = null) {
    rhcRunHosts = await exports.formatRunHosts(rhcRunHosts, playbook_run_id);

    _.forEach(rhcRunHosts, host => {
        if (!filter_hostname || host.system_name.indexOf(filter_hostname) >= 0) {
            systems.push(host);
        }
    });
};

// add rhc playbook run data to remediation
exports.combineRuns = async function (remediation) {
    const iteration = remediation.iteration;  // this was added to make the logging prettier

    trace.enter(`[${iteration}] fifi.combineRuns`);

    // array of playbook_run_id
    for (const run of remediation.playbook_runs) {
        // query playbook-dispatcher to see if there are any RHC direct or
        // RHC satellite hosts for this playbook run...
        trace.event(`[${iteration}] Fetch run details for run: ${run.id}`);
        const dispatcherRuns = await exports.getRHCRuns(run.id); // run.id is playbook_run_id

        if (dispatcherRuns) {
            trace.event(`[${iteration}] Format run details and add it to the remediation`)
            const executors = await formatRHCRuns(dispatcherRuns, run.id);
            pushRHCExecutor(executors, run);
        }
    }

    trace.leave(`[${iteration}] fifi.combineRuns`);
    return remediation.playbook_runs;
};

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

exports.cancelPlaybookRun = async function (account_number, org_id, playbook_run_id, username, executors) {
    if (_.isEmpty(executors)) {
        const request = [prepareRHCCancelRequest(org_id, playbook_run_id, username)];
        await dispatchRHCCancelRequests(request);
    } else {
        const requests = executors.map(executor => prepareReceptorCancelRequest(account_number, executor, playbook_run_id));
        await dispatchReceptorCancelRequests(requests, playbook_run_id);
    }
};

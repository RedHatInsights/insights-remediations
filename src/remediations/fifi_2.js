'use strict';

const _ = require("lodash");
const uuid = require("uuid");

const format = require("./remediations.format_2");
const errors = require("../errors");
const configManager = require("../connectors/configManager");
const probes = require("../probes");
const dispatcher = require("../connectors/dispatcher");
const log = require("../util/log");
const queries = require("./remediations.queries");

// status constants
const CONNECTED = 'connected';
const DISCONNECTED = 'disconnected';
const DISABLED = 'disabled';
const PENDING = 'pending';
const FAILURE = 'failure';
const RUNNING = 'running';
const SUCCESS = 'success';
const CANCELED = 'canceled';

// recipient types
const DIRECT = 'directConnect';
const SATELLITE = 'satellite';
const NONE = 'none';


exports.checkRhcEnabled = async function () {
    const rhcProfiles = await configManager.getCurrentProfile();

    return !! rhcProfiles?.remediations;
};


//======================================================================================================================

// This is just so we can stub uuid.v4 to force a uuid for snapshot testing
exports.uuidv4 = function () {
    return uuid.v4();
};

//--------------------------------------------
// Perform a playbook run against recipients
//
// recipients - array of recipients returned from dispatcher getConnectionStatus
//   [
//       {
//           "org_id": "5318290",
//           "recipient": "d415fc2d-9700-4e30-9621-6a410ccc92d8",
//           "recipient_type": "satellite",
//           "sat_id": "bd54e0e9-5310-45be-b107-fd7c96672ce5",
//           "sat_org_id": "5",
//           "status": "connected",
//           "systems": [
//               "c484f980-ab8d-401b-90e7-aa1d4ccf8c0e",
//               "d0e03cfb-c2fe-4207-809d-6c203f7811c7"
//           ]
//       },
//       {
//           "org_id": "5318290",
//           "recipient": "32af5948-301f-449a-a25b-ff34c83264a2",
//           "recipient_type": "directConnect",
//           "sat_id": "",
//           "sat_org_id": "",
//           "status": "connected",
//           "systems": [
//               "fe30b997-c15a-44a9-89df-c236c3b5c540"
//           ]
//       }
//   ]
// exclude - a list of host inventory ids to exclude
// remediation - the id of the associated remediation
// username - the username of the entity initiating the playbook run
//--------------------------------------------
exports.createPlaybookRun = async function (recipients, exclude, remediation, username) {
    // create UUID for this run
    const playbook_run_id = exports.uuidv4();

    // check if excludes contains anything NOT in targets
    validateExcludes(exclude, recipients);

    // create work requests
    const workRequests = createWorkRequests(playbook_run_id, recipients, exclude, remediation, username);

    // return 422 if no work remains
    if (_.isEmpty(workRequests)) {
        throw errors.noExecutors(remediation);
    }

    // create playbook run db entry
    await storePlaybookRun(playbook_run_id, remediation, username);

    // dispatch requests
    const response = await dispatchWorkRequests(workRequests, playbook_run_id);

    if (response === null) {
        return null;
    }

    // return run UUID
    return playbook_run_id;
};



//----------------------------------------------------------------------------------
// Verify that the exclude list does not contain sat_ids not in list of recipients
//----------------------------------------------------------------------------------
function validateExcludes (excludes, recipients) {
    // throw error if any exclude not in recipients
    const unknownExcludes = _.difference(excludes, _.filter(excludes, exclude_id => {
        if (exclude_id === 'RHC') {
            return _.find(recipients, recipient => recipient.recipient_type === DIRECT);
        }

        return _.find(recipients, recipient => recipient.sat_id === exclude_id);
    }));

    if (!_.isEmpty(unknownExcludes)) {
        throw errors.unknownExclude(unknownExcludes);
    }

    return true;
}



//------------------------------------------------------------------------------------
// Create playbook-dispatcher work requests given list of recipients and remediation
//------------------------------------------------------------------------------------
function createWorkRequests (playbook_run_id, recipients, exclude, remediation, username) {
    const excludeDirectTargets = exclude.includes('RHC');

    if (_.isEmpty(recipients)) {
        return [];
    }

    // create request object for each valid item in recipients array
    const workRequests = recipients.flatMap(recipient => {
        switch (recipient.recipient_type) {
            case 'satellite':
                // skip any disconnected satellites or those in the exclude list
                if (recipient.status !== CONNECTED || exclude.includes(recipient.sat_id)) {
                    return [];
                }

                return [format.rhcSatelliteWorkRequestV2(playbook_run_id, recipient, remediation, username)];

            case 'directConnect':
                // skip all direct connect if exclude contains 'RHC'
                if (excludeDirectTargets || recipient.status !== CONNECTED) {
                    return [];
                }

                return [format.rhcDirectWorkRequestV2(playbook_run_id, recipient, remediation, username)];

            default:
                // skip these
                return [];
        }
    });

    return workRequests;
}



//----------------------------------------------
// Submit work requests to playbook-dispatcher
//----------------------------------------------
async function dispatchWorkRequests (workRequests, playbook_run_id) {
    try {
        probes.workRequest(workRequests, playbook_run_id);
        const response = await dispatcher.postV2PlaybookRunRequests(workRequests);
        probes.JobDispatched(response, playbook_run_id);

        // handle aggregate responses
        const results = [... new Set(_.map(response, 'code'))];
        if (results.some(i=> i >= 300)) {
            // TODO: maybe return better HTTP status here
            log.warn({results}, 'Some dispatcher requests failed');
            return null;
        }

        // Store dispatcher runs
        const successfulRuns = response
            .filter(r => (r.code >= 200 && r.code < 300) && r.id)
            .map(r => ({
                dispatcher_run_id: r.id,
                remediations_run_id: playbook_run_id
            }));

        if (successfulRuns.length) {
            await queries.insertDispatcherRuns(successfulRuns);
        }
        return response;
    } catch (e) {
        log.error({workRequest: workRequests, error: e}, 'Failed to dispatch work requests and save dispatcher runs');
        return null;
    }
}



//----------------------------------------------
// Create DB entry to record this playbook run
//----------------------------------------------
async function storePlaybookRun (playbook_run_id, remediation, username) {
    const run = {
        id: playbook_run_id,
        remediation_id: remediation.id,
        created_by: username
    };

    await queries.insertRHCPlaybookRun(run);
}

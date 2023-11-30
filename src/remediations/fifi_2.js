'use strict';

const _ = require("lodash");
const {v4: uuidv4} = require("uuid");

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
    const rhcStates = await configManager.getCurrentState();

    if (rhcStates.state.remediations === DISABLED) {
        return false;
    }

    return true;
};


//======================================================================================================================


//--------------------------------------------
// Perform a playbook run against recipients
//--------------------------------------------
exports.createPlaybookRun = async function (recipients, exclude, remediation, username) {
    // create UUID for this run
    const playbook_run_id = uuidv4();

    // TODO: check if excludes contains anything NOT in targets
    validateExcludes(exclude, recipients);

    // create work requests
    const workRequests = createWorkRequests(playbook_run_id, recipients, exclude, remediation, username);

    // return 422 if no work remains
    if (_.isEmpty(workRequests)) {
        throw new errors.noExecutors(remediation);
    }

    // dispatch requests
    const response = await dispatchWorkRequests(workRequests, playbook_run_id);

    if (response === null) {
        return null;
    }

    // create playbook run db entry
    await storePlaybookRun(playbook_run_id, remediation, username);

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
            return _.find(recipients, recipient => recipient.type === DIRECT);
        }

        return _.find(recipients, recipient => recipient.satId === exclude_id);
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
            // TODO: we should log some details and maybe return better HTTP status here
            return null;
        }

        return response;
    } catch (e) {
        log.error({workRequest: workRequests, error: e}, 'error sending work request to playbook-dispatcher');
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

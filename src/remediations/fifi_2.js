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
const {createPlaybookRun} = require("./fifi");

// status constants
const CONNECTED = 'connected';
const DISCONNECTED = 'disconnected';
const DISABLED = 'disabled';
const PENDING = 'pending';
const FAILURE = 'failure';
const RUNNING = 'running';
const SUCCESS = 'success';
const CANCELED = 'canceled';


exports.checkRhcEnabled = async function () {
    const rhcStates = await configManager.getCurrentState();

    if (rhcStates.state.remediations === DISABLED) {
        return false;
    }

    return true;
};


exports.createPlaybookRun = async function (recipients, exclude, remediation, username) {
    // create UUID for this run
    const playbook_run_id = uuidv4();

    // TODO: check if excludes contains anything NOT in targets

    // create request object for each valid item in targets array
    const excludeDirectTargets = exclude.includes('RHC');

    const workRequests = recipients.flatMap(recipient => {
        switch (recipient.recipient_type) {
            case 'satellite':
                // skip any disconnected satellites or those in the exclude list
                if (recipient.status !== 'connected' || exclude.includes(recipient.sat_id)) {
                    return [];
                }

                return [format.rhcSatelliteWorkRequestV2(playbook_run_id, recipient, remediation, username)];

            case 'directConnect':
                // skip all direct connect if exclude contains 'RHC'
                if (excludeDirectTargets) {
                    return [];
                }

                return [format.rhcDirectWorkRequestV2(playbook_run_id, recipient, remediation, username)];

            default:
                // skip these
                return [];
        }
    });

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



async function storePlaybookRun (playbook_run_id, remediation, username) {
    const run = {
        id: playbook_run_id,
        remediation_id: remediation.id,
        created_by: username
    };

    await queries.insertRHCPlaybookRun(run);
}

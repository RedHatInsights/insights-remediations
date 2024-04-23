'use strict';

const URI = require("urijs");
const config = require("../config");
const log = require("../util/log");
const _ = require("lodash");

const PD_TYPE_SATELLITE = 'satellite';
const REM_TYPE_SATELLITE = 'RHC-satellite';
const PD_TYPE_DIRECT = 'directConnect';
const REM_TYPE_DIRECT = 'RHC';
const PD_TYPE_NONE = 'none';
const REM_TYPE_NONE = 'None';

const PD_STATUS_CONNECTED = 'connected';
const REM_STATUS_CONNECTED = 'connected';
const PD_STATUS_DISCONNECTED = 'disconnected';
const REM_STATUS_DISCONNECTED = 'disconnected';
const PD_STATUS_NOT_CONFIGURED = 'rhc_not_configured';
const REM_STATUS_NOT_CONFIGURED = 'no_rhc';

const recipientStatusMap = {};
recipientStatusMap[PD_STATUS_CONNECTED] = REM_STATUS_CONNECTED;
recipientStatusMap[PD_STATUS_DISCONNECTED] = REM_STATUS_DISCONNECTED;
recipientStatusMap[PD_STATUS_NOT_CONFIGURED] = REM_STATUS_NOT_CONFIGURED;
recipientStatusMap['no_rhc'] = 'no_rhc';


//======================================================================================================================
//          Exported functions
//======================================================================================================================


//----------------------------------------------------------------------------------------------------------------------
// Construct an array of status objects for recipients returned by playbook-dispatcher.
//
// The recipient list from playbook-dispatcher will include one item for each satellite organization, with a list
// of systems in that organization, and one item for each system not managed by a satellite (direct and unconnected
// systems).  For the non-satellite systems, we group the systems into three categories: connected, disconnected and
// no_rhc [no_rhc means RHC is not configured on the system and these systems are essentially unreachable - the only
// way to remediate them is to download a playbook and run it manually].  Systems managed by a satellite all have the
// same connection status
//----------------------------------------------------------------------------------------------------------------------
exports.connectionStatus = function (recipients) {

    const data = _(recipients)
    .groupBy(recipient => {
        // key will either be one of recipientStatusMap or a recipient_id UUID
        switch (recipient.recipient_type) {
            case PD_TYPE_DIRECT:
                return recipient.status;

            case PD_TYPE_SATELLITE:
                return `${recipient.sat_id} ${recipient.sat_org_id}`;

            default:
                return PD_STATUS_NOT_CONFIGURED;
        }
    })
    .map((items, group) => {
        switch (group) {
            // handle direct disconnected, connected, and non-rhc systems
            case PD_STATUS_CONNECTED:
            case PD_STATUS_DISCONNECTED:
            case PD_STATUS_NOT_CONFIGURED:

                const system_ids = _(items).map('systems').flatten().value();

                return {
                    endpoint_id: null,
                    executor_id: null,
                    executor_type: REM_TYPE_DIRECT,
                    executor_name: null,
                    system_count: system_ids.length,
                    system_ids: system_ids,
                    connection_status: recipientStatusMap[group] // because our enums don't match dispatcher's
                };

            default:
                // handle RHC-satellites
                if (items.length > 1) {
                    log.error(`Duplicate recipient id!\nid = ${group}\nrecipients = ${JSON.stringify(recipients)}`);
                }
                const sat = items[0];
                return {
                    endpoint_id: null,
                    executor_id: sat.sat_id,
                    executor_type: REM_TYPE_SATELLITE,
                    executor_name: `Satellite ${sat.sat_id} Org ${sat.sat_org_id}`,
                    system_count: sat.systems.length,
                    system_ids: sat.systems,
                    connection_status: recipientStatusMap[sat.status]
                };
        }
    })
    .sortBy('executor_name')
    .value();

    return {
        meta: {
            count: data.length,
            total: data.length
        },
        data
    };
};


//------------------------------------------------------------------------------------------------------------
// rhcDirectWorkRequestV2 - returns json suitable for submission to playbook-dispatcher/internal/v2/dispatch
//
//   recipient:
//   [
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

exports.rhcDirectWorkRequestV2 = function (playbookRunId, recipient, remediation, username) {
    const work_request =  {
        recipient: recipient.recipient,
        org_id: recipient.org_id,
        url: new URI(`https://${config.platformHostname}`)
            .segment([config.path.prefix, config.path.app, `v1/remediations/${remediation.id}/playbook`])
            .search({hosts: recipient.systems, localhost: null}) // 'null' just adds &localhost (i.e. it has no value)
            .toString(),
        name: remediation.name,
        principal: username,
        web_console_url: "https://console.redhat.com/insights/remediations",
        labels: {
            'playbook-run': playbookRunId
        },
        hosts: [
            {
                inventory_id: recipient.systems[0],  // there should only be one...
                ansible_host: 'localhost'
            }
        ]
    };

    return work_request;
};



exports.rhcSatelliteWorkRequestV2 = function (playbookRunId, recipient, remediation, username) {
    return {
        recipient: recipient.recipient,
        org_id: recipient.org_id,
        url: new URI(`https://${config.platformHostname}`)
            .segment([config.path.prefix, config.path.app, `v1/remediations/${remediation.id}/playbook`])
            .search({hosts: recipient.systems})
            .toString(),
        name: remediation.name,
        principal: username,
        web_console_url: "https://console.redhat.com/insights/remediations",
        labels: { 'playbook-run': playbookRunId },
        recipient_config: {
            sat_id: recipient.sat_id,
            sat_org_id: recipient.sat_org_id
        },
        hosts: recipient.systems.map(system => ({
            inventory_id: system,
//          ansible_host: "<populate me!>"  TODO: do we need this?  The old code didn't supply it...
        }))
    };
};

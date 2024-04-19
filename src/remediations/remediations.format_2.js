'use strict';

const URI = require("urijs");
const config = require("../config");
const log = require("../util/log");
const _ = require("lodash");

const recipientTypeMap = {
    'satellite': 'RHC-satellite',
    'directConnect': 'RHC',
    'none': 'none'
};

const recipientStatusMap = {
    'connected': 'connected',
    'disconnected': 'disconnected',
    'rhc_not_configured': 'no_rhc',
    'no_rhc': 'no_rhc'
};


//============================================================================================================
//  Helper functions
//============================================================================================================


function computeStatus(recipients) {
    // calculate aggregate status:
    // > 0 connected -> connected
    if (_.find(recipients, {status: 'connected'})) {
        return recipientStatusMap.connected;
    }

    // > 0 disconnected -> disconnected
    if (_.find(recipients, {status: 'disconnected'})) {
        return recipientStatusMap.disconnected;
    }

    // else not_configured -> not_configured
    return recipientStatusMap.rhc_not_configured;
}


//============================================================================================================
//  Exported functions
//============================================================================================================


exports.connectionStatus = function (recipients) {
    // one entry for:
    //   - each satellite
    //   - all connected direct
    //   - all disconnected direct
    //   - all no-rhc direct
    const data = _(recipients)
        .groupBy(recipient => {
            switch (recipient.recipient_type) {
                case 'satellite':
                    return `${recipient.sat_id} ${recipient.sat_org_id}`;

                default:
                    return recipient.recipient_type;
            }
        })
        .map((targets) => {
            const recipient = targets[0];
            switch (recipient.recipient_type) {
                case 'satellite':
                    return {
                        endpoint_id: null,
                        executor_id: recipient.sat_id,
                        executor_type: 'RHC-satellite',
                        executor_name: `Satellite ${recipient.sat_id} Org ${recipient.sat_org_id}`,
                        system_count: recipient.systems.length,
                        connection_status: recipientStatusMap[recipient.status]
                    };

                case 'directConnect':
                    return {
                        endpoint_id: null,
                        executor_id: null,
                        executor_type: 'RHC',
                        executor_name: null,
                        system_count: targets.length,
                        connection_status: computeStatus(targets)
                    };

                default:
                    return {
                        endpoint_id: null,
                        executor_id: null,
                        executor_type: 'None',
                        executor_name: null,
                        system_count: recipient.systems.length,
                        connection_status: recipientStatusMap[recipient.status]
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

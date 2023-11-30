'use strict';

const URI = require("urijs");
const config = require("../config");
const _ = require("lodash");

const recipientTypeMap = {
    'satellite': 'RHC-satellite',
    'directConnect': 'RHC',
    'none': 'none'
};

const recipientStatusMap = {
    'connected': 'connected',
    'disconnected': 'disconnected',
    'rhc_not_configure': 'no_rhc',
    'no_rhc': 'no_rhc'
};


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
                        connection_status: recipientStatusMap[recipient.status]
                    };

                default:
                    return {
                        endpoint_id: null,
                        executor_id: null,
                        executor_type: 'None',
                        executor_name: null,
                        system_count: targets.length,
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



exports.rhcDirectWorkRequestV2 = function (playbookRunId, target, remediation, username) {
    return {
        recipient: target.recipient,
        org_id: target.org_id,
        url: new URI(`https://${config.platformHostname}`)
            .segment([config.path.prefix, config.path.app, `v1/remediations/${remediation.id}/playbook`])
            .search({hosts: target.systems}) // there should only be one...
            .search('localhost')
            .toString(),
        name: remediation.name,
        principal: username,
        web_console_url: "https://console.redhat.com/insights/remediations",
        labels: { 'playbook-run': playbookRunId }
    };
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

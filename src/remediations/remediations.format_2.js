'use strict';

const URI = require("urijs");
const config = require("../config");


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

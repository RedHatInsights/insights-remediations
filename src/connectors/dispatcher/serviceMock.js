'use strict';

const _ = require('lodash');
const P = require('bluebird');
const {generateSystemInfo} = require('../inventory/systemGenerator');
const {INTEGER} = require("sequelize");

/**
 * This module simulates the behavior of the playbook-dispatcher service.
 */

module.exports = function (req) {
    const result = [];

    // for each host in req.hosts return an appropriate status object
    // one for each direct hosts
    // one for each satellite org
    //   add recipient id and type (follow inventory/systemGenerator.js)
    //   groupBy recipient id
    const systems = req.body.hosts.map(system => {
        const details = generateSystemInfo(system);
        details.recipient_type = details.satelliteManaged ? 'satellite' : 'directConnect';
        details.recipient = details.satelliteManaged ? generateSatReceptorId(details) : details.rhc_client;
        details.status = computeConnectionStatus(system);
        return details;
    });

    // separate by computed status
    const statuses = _.groupBy(systems, 'status');

    for (const status in statuses) {
        const recipients = _.groupBy(statuses[status], 'recipient');

        for (const recipient in recipients) {
            const data = recipients[recipient];

            result.push({
                recipient_type: data[0].recipient_type,
                recipient: data[0].recipient,
                org_id: req.body.org_id || '',
                sat_id: data[0].satelliteId || '',
                sat_org_id: data[0].satelliteOrgId,
                systems: _.map(data, 'id'),
                status: status
            });
        }
    };

    return P.resolve({
        statusCode: 200,
        body: result,
        headers: {}
    });
};

function generateSatReceptorId (system_details) {
    const receptor_id = system_details.satelliteId.split('');
    receptor_id[35] = system_details.satelliteOrgId;
    return receptor_id.join('');
};

function computeConnectionStatus (system_id) {
    const status = [
        'connected',
        'disconnected',
        'rhc_not_configured'
    ];

    const type = parseInt(system_id.split('')[34], 16) % 3;
    return status[type];
};
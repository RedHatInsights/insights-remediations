'use strict';

const _ = require('lodash');
const P = require('bluebird');

const inventory = require('../connectors/inventory');
const sources = require('../connectors/sources');
const receptorConnector = require('../connectors/receptor');

const SATELLITE_TAG = Object.freeze({namespace: 'satellite', key: 'satellite_id'});
const SYSTEM_FIELDS = Object.freeze(['id', 'ansible_host', 'hostname', 'display_name']);

async function fetchSystems (ids) {
    const [systemDetails, systemTags] = await P.all([
        inventory.getSystemDetailsBatch(ids),
        inventory.getTagsByIds(ids)
    ]);

    return _(ids).map(id => _.get(systemDetails, id)).filter().map(system => {
        system.tags = _.get(systemTags, system.id, []);
        return system;
    }).value();
}

function getSatelliteId (tags) {
    const tag = _.find(tags, SATELLITE_TAG);
    if (tag) {
        return tag.value;
    }

    return null;
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
    if (executor.source) {
        return executor.source.name;
    }

    if (executor.id) {
        return `Satellite ${executor.id}`;
    }

    return null;
}

function getStatus (executor) {
    if (!executor.id) {
        return 'no_executor';
    }

    if (!executor.source) {
        return 'no_source';
    }

    if (!executor.receptor) {
        return 'no_receptor';
    }

    if (executor.receptorStatus !== 'connected') {
        return 'disconnected';
    }

    return 'connected';
}

function normalize (satellites) {
    return _.map(satellites, satellite => ({
        satId: satellite.id,
        receptorId: _.get(satellite.receptor, 'receptor_node', null),
        systems: _.map(satellite.systems, system => _.pick(system, SYSTEM_FIELDS)),
        type: satellite.id ? 'satellite' : null,
        name: getName(satellite),
        status: getStatus(satellite)
    }));
}

exports.getConnectionStatus = async function (remediation, account) {
    const systemsIds = _(remediation.issues).flatMap('systems').map('system_id').uniq().sort().value();
    const systems = await fetchSystems(systemsIds);

    _.forEach(systems, system => system.satelliteId = getSatelliteId(system.tags));

    const satellites = _(systems).groupBy('satelliteId').mapValues(systems => ({
        id: systems[0].satelliteId,
        systems
    })).values().value();

    const sourceInfo = await sources.getSourceInfo(_(satellites).map('id').filter().value());

    _.forEach(satellites, satellite => {
        satellite.source = _.get(sourceInfo, satellite.id, null);
        satellite.receptor = getReceptor(satellite.source);
    });

    await P.map(satellites, async satellite => {
        satellite.receptorStatus = await fetchReceptorStatus(satellite.receptor, account);
    });

    return normalize(satellites);
};

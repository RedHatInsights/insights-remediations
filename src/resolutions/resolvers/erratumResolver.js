'use strict';

const vmaas = require('../../connectors/vmaas');
const ErratumResolution = require('../ErratumResolution');

exports.resolveResolutions = async function (id) {
    const isCve = id.issue.startsWith('CVE');
    const fetch = isCve ? vmaas.getCve : vmaas.getErratum;
    const build = isCve ? ErratumResolution.forCve : ErratumResolution.forAdvisory;

    return await resolve(id, fetch, build);
};

async function resolve (id, fetch, build) {
    const erratum = await fetch(id.issue);

    if (!erratum) {
        return [];
    }

    return [build(id, erratum)];
}

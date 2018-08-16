'use strict';

const vmaas = require('../../connectors/vmaas');
const ErratumResolution = require('../ErratumResolution');

exports.resolveResolutions = async function (id) {
    const erratum = await vmaas.getErratum(id.issue);

    if (!erratum) {
        return [];
    }

    return [new ErratumResolution(id, erratum)];
};

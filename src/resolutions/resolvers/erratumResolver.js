'use strict';

const vmaas = require('../../connectors/vmaas');
const ErratumResolution = require('../ErratumResolution');

exports.resolveResolution = async function (id) {
    const erratum = (await vmaas.getErratum(id.issue))[id.issue];

    if (!erratum) {
        return;
    }

    return new ErratumResolution(erratum);
};

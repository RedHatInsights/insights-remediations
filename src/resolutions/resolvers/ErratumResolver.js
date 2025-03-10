'use strict';

const vmaas = require('../../connectors/vmaas');
const ErratumResolution = require('../ErratumResolution');
const CVEResolver = require('./CVEResolver');

module.exports = class ErratumResolver extends CVEResolver {

    fetch (req, id) {
        return vmaas.getErratum(req, id.issue);
    }

    build(id, entity) {
        return ErratumResolution.forAdvisory(id, entity);
    }
};

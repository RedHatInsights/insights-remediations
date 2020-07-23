'use strict';

const vmaas = require('../../connectors/vmaas');
const ErratumResolution = require('../ErratumResolution');
const CVEResolver = require('./CVEResolver');

module.exports = class PackageResolver extends CVEResolver {

    fetch (id) {
        return vmaas.getPackage(id.issue);
    }

    build(id, entity) {
        return ErratumResolution.forPackage(id, entity);
    }
};

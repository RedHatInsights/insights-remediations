'use strict';

const ErratumResolution = require('../ErratumResolution');
const CVEResolver = require('./CVEResolver');

module.exports = class PackageResolver extends CVEResolver {

    build(id) {
        return ErratumResolution.forPackage(id, '');
    }

    async resolveResolutions (id) {
        return [this.build(id)];
    }
};

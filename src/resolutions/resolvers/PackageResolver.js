'use strict';

const ErratumResolution = require('../ErratumResolution');
const CVEResolver = require('./CVEResolver');

module.exports = class PackageResolver extends CVEResolver {

    build(id) {
        return ErratumResolution.forPackage(id, '');
    }

   // probably dont need to pass req here
    async resolveResolutions (req, id) {
        return [this.build(id)];
    }
};

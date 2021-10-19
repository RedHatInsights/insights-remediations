'use strict';

const patchman = require('../../connectors/patchman');
const ErratumResolution = require('../ErratumResolution');
const CVEResolver = require('./CVEResolver');

module.exports = class PackageResolver extends CVEResolver {

    fetch (id) {
        return patchman.getPackage(id.issue);
    }

    build(id, entity) {
        return ErratumResolution.forPackage(id, entity);
    }

    async resolveResolutions (id) {
        const entity = await this.fetch(id);

        if (Object.keys(entity).length === 0) {
            return [];
        }

        return [this.build(id, entity)];
    }
};

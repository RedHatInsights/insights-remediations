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

    async resolveResolutions (id) {
        const entity = await this.fetch(id);

        if (Object.keys(entity).length === 0) {
            return [];
        }

        return [this.build(id, entity)];
    }
};

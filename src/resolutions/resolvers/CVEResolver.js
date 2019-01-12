'use strict';

const vmaas = require('../../connectors/vmaas');
const ErratumResolution = require('../ErratumResolution');
const Resolver = require('./Resolver');

module.exports = class CVEResolver extends Resolver {

    fetch (id) {
        return vmaas.getCve(id.issue);
    }

    build(id, entity) {
        return ErratumResolution.forCve(id, entity);
    }

    async resolveResolutions (id) {
        const entity = await this.fetch(id);

        if (!entity) {
            return [];
        }

        return [this.build(id, entity)];
    }
};

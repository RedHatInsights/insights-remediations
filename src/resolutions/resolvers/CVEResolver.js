'use strict';

const getTrace = require('../../util/trace');
const vmaas = require('../../connectors/vmaas');
const ErratumResolution = require('../ErratumResolution');
const Resolver = require('./Resolver');

module.exports = class CVEResolver extends Resolver {

    fetch (req, id) {
        return vmaas.getCve(req, id.issue);
    }

    build(id, entity) {
        return ErratumResolution.forCve(id, entity);
    }

    async resolveResolutions (req, id) {
        getTrace(req).enter('CVEResolver.resolveResolutions');

        getTrace(req).event(`Fetch resolutions for: ${id}`);
        const entity = await this.fetch(req, id);
        getTrace(req).event(`Resolutions: ${JSON.stringify(entity)}`);

        if (!entity) {
            getTrace(req).leave('No resolutions found!');
            return [];
        }

        const result = [this.build(id, entity)];
        getTrace(req).leave(`Returning: ${JSON.stringify(result)}`);
        return result;
    }

    isRebootNeeded () {
        return true; // right now the CVE template requires reboot always
    }
};

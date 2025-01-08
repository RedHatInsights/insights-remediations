'use strict';

const trace = require('../../util/trace');
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
        trace.enter('CVEResolver.resolveResolutions');

        trace.event(`Fetch resolutions for: ${id}`);
        const entity = await this.fetch(req, id);
        trace.event(`Resolutions: ${JSON.stringify(entity)}`);

        if (!entity) {
            trace.leave('No resolutions found!');
            return [];
        }

        const result = [this.build(id, entity)];
        trace.leave(`Returning: ${JSON.stringify(result)}`);
        return result;
    }

    isRebootNeeded () {
        return true; // right now the CVE template requires reboot always
    }
};

'use strict';

const errors = require('../../errors');
const ResolutionPlay = require('../plays/ResolutionPlay');
const testResolver = new(require('../../resolutions/resolvers/TestResolver'))();
const Factory = require('./Factory');

module.exports = class TestFactory extends Factory {

    async createPlay ({id, resolution, hosts}, req) {
        const resolutions = await testResolver.resolveResolutions(req, id);

        const disambiguatedResolution = this.disambiguate(req, resolutions, resolution, id, true);
        if (disambiguatedResolution) {
            return new ResolutionPlay(id, hosts, disambiguatedResolution);
        }

        throw errors.unsupportedIssue(req, id);
    }
};

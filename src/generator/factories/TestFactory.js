'use strict';

const errors = require('../../errors');
const ResolutionPlay = require('../plays/ResolutionPlay');
const testResolver = new(require('../../resolutions/resolvers/TestResolver'))();
const Factory = require('./Factory');

module.exports = class TestFactory extends Factory {

    async createPlay ({id, hosts}) {
        const resolutions = await testResolver.resolveResolutions(id);
        if (resolutions.length === 1) {
            return new ResolutionPlay(id, hosts, resolutions[0]);
        }

        throw errors.unsupportedIssue(id);
    }
};

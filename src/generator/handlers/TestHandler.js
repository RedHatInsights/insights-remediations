'use strict';

const errors = require('../../errors');
const ResolutionPlay = require('../plays/ResolutionPlay');
const testResolver = require('../../resolutions/resolvers/testResolver');

exports.application = 'test';

exports.createPlay = async function ({id, hosts}) {
    const resolutions = await testResolver.resolveResolutions(id);
    if (resolutions.length === 1) {
        return new ResolutionPlay(id, hosts, resolutions[0]);
    }

    throw errors.unsupportedIssue(id);
};

exports.getResolver = function () {
    return testResolver;
};

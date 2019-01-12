'use strict';

const Handler = require('./Handler');

const testResolver = require('../resolutions/resolvers/testResolver');
const testFactory = require('../generator/factories/TestFactory');

module.exports = class TestHandler extends Handler {
    getPlayFactory () {
        return testFactory;
    }

    getResolutionResolver () {
        return testResolver;
    }
};

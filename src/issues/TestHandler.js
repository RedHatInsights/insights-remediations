'use strict';

const Handler = require('./Handler');

const testResolver = new(require('../resolutions/resolvers/TestResolver'))();
const testFactory = new(require('../generator/factories/TestFactory'))();

module.exports = class TestHandler extends Handler {
    getPlayFactory () {
        return testFactory;
    }

    getResolutionResolver () {
        return testResolver;
    }
};

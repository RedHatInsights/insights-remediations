'use strict';

const Handler = require('./Handler');
const csawResolver = new(require('../resolutions/resolvers/CSAWResolver'))();
const csawFactory = new(require('../generator/factories/CSAWFactory'))();

module.exports = class CVEHandler extends Handler {
    getResolutionResolver () {
        return csawResolver;
    }

    getPlayFactory () {
        return csawFactory;
    }
};

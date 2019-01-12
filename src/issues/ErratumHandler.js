'use strict';

const CVEHandler = require('./CVEHandler');

const vmaas = require('../connectors/vmaas');
const erratumResolver = new(require('../resolutions/resolvers/ErratumResolver'))();

module.exports = class ErratumHandler extends CVEHandler {

    getIssueDetailsInternal (id) {
        return vmaas.getErratum(id.issue);
    }

    getResolutionResolver () {
        return erratumResolver;
    }
};


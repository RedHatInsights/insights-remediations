'use strict';

const CVEHandler = require('./CVEHandler');

const vmaas = require('../connectors/vmaas');
const erratumResolver = new(require('../resolutions/resolvers/ErratumResolver'))();

module.exports = class ErratumHandler extends CVEHandler {

    getIssueDetailsInternal (req, id) {
        return vmaas.getErratum(req, id.issue);
    }

    getResolutionResolver () {
        return erratumResolver;
    }
};


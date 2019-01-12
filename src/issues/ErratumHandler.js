'use strict';

const CVEHandler = require('./CVEHandler');

const vmaas = require('../connectors/vmaas');

module.exports = class ErratumHandler extends CVEHandler {

    getIssueDetailsInternal (id) {
        return vmaas.getErratum(id.issue);
    }
};


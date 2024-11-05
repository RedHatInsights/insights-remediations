'use strict';

const patchman = require('../../connectors/patchman');
const ErratumResolver = require('./ErratumResolver');

module.exports = class PatchmanResolver extends ErratumResolver {

    fetch (req, id) {
        return patchman.getErratum(req, id.issue);
    }
};

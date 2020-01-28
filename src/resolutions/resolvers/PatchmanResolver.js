'use strict';

const patchman = require('../../connectors/patchman');
const ErratumResolver = require('./ErratumResolver');

module.exports = class PatchmanResolver extends ErratumResolver {

    fetch (id) {
        return patchman.getErratum(id.issue);
    }
};

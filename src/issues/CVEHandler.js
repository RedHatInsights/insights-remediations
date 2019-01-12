'use strict';

const Handler = require('./Handler');
const errors = require('../errors');

const vmaas = require('../connectors/vmaas');
const erratumResolver = require('../resolutions/resolvers/erratumResolver');
const cveFactory = require('../generator/factories/CveFactory');

module.exports = class CVEHandler extends Handler {

    getIssueDetailsInternal (id) {
        return vmaas.getCve(id.issue);
    }

    async getIssueDetails (id) {
        const raw = await this.getIssueDetailsInternal(id);

        if (!raw) {
            throw errors.unknownIssue(id);
        }

        return {
            description: id.issue,
            raw
        };
    }

    getResolutionResolver () {
        return erratumResolver;
    }

    getPlayFactory () {
        return cveFactory;
    }
};


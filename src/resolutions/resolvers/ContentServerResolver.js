'use strict';

const contentServer = require('../../connectors/contentServer');
const Resolver = require('./Resolver');
const shared = require('./SharedFunctions');

module.exports = class ContentServerResolver extends Resolver {

    async resolveResolutions (id) {
        const templates = await contentServer.getResolutions(id.issue);
        return templates.map(template => shared.parseResolution(template, id));
    }
};

'use strict';

const Play = require('../Play');
const disambiguator = require('../disambiguator');
const contentServerResolver = require('../templates/resolvers/ContentServerResolver');

exports.application = 'advisor';

exports.createPlay = async function ({id, resolution, hosts}) {
    const templates = await contentServerResolver.resolveTemplates(id);

    // TODO get metadata

    if (templates.length) {
        const template = disambiguator.disambiguate(templates, resolution, id);
        return new Play(id, template, hosts);
    }
};


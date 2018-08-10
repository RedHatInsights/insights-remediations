'use strict';

const P = require('bluebird');
const RemediationPlay = require('../RemediationPlay');
const advisor = require('../../connectors/advisor');
const disambiguator = require('../disambiguator');
const contentServerResolver = require('../templates/resolvers/ContentServerResolver');

exports.application = 'advisor';

exports.createPlay = async function ({id, resolution, hosts}) {
    const [templates, rule] = await P.all([
        contentServerResolver.resolveTemplates(id),
        advisor.getRule(id.issue)
    ]);

    if (!templates.length || !rule) {
        return;
    }

    const template = disambiguator.disambiguate(templates, resolution, id);
    return new RemediationPlay(id, template, hosts, rule.description);
};


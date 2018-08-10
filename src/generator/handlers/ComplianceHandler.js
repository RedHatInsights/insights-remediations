'use strict';

const P = require('bluebird');
const RemediationPlay = require('../RemediationPlay');
const compliance = require('../../connectors/compliance');
const ssgResolver = require('../templates/resolvers/SSGResolver');

exports.application = 'compliance';

exports.createPlay = async function ({id, hosts}) {
    const [template, rule] = await P.all([
        ssgResolver.resolveTemplate(id),
        compliance.getRule(id.issue)
    ]);

    if (!template || !rule) {
        return;
    }

    return new RemediationPlay(id, template, hosts, rule.description);
};


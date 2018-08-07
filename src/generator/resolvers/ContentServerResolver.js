'use strict';

const _ = require('lodash');
const P = require('bluebird');
const contentServer = require('../../external/contentServer');
const Template = require('../templates/Template');
const identifiers = require('../../util/identifiers');
const yaml = require('../../util/yaml');

const INSIGHTS_DIAGNOSIS_VAR_NAME = 'insights_report';

exports.resolveTemplates = async function (ids) {
    const filtered = ids
    .map(identifiers.parse)
    .filter(id => id.app === 'advisor' || id.app === 'vulnerabilities' && id.issue.includes('|'));

    if (!filtered.length) {
        return {};
    }

    const pending = _(filtered)
    .keyBy(id => id.full)
    .mapValues(resolve)
    .value();

    const resolved = await P.props(pending);
    return _.pickBy(resolved);
};

async function resolve (id) {
    const templates = await getTemplates(id);

    if (templates) {
        return templates.map(template => parseTemplate(template, id));
    }
}

async function getTemplates (id) {
    try {
        return await contentServer.getResolutions(id.issue, true);
    } catch (e) {
        if (e.name === 'StatusCodeError' && e.statusCode === 404) {
            return;
        }

        throw e;
    }
}

function parseTemplate (template) {
    const play = template.play.replace('{{HOSTS}}', Template.HOSTS_PLACEHOLDER);
    const needsDiagnosis = yaml.isVariableUsed(INSIGHTS_DIAGNOSIS_VAR_NAME, play);
    return new Template(play, template.resolution_type, template.needs_reboot, needsDiagnosis);
}

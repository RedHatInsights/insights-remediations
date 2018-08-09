'use strict';

const contentServer = require('../../../external/contentServer');
const Template = require('../Template');
const yaml = require('../../../util/yaml');

const INSIGHTS_DIAGNOSIS_VAR_NAME = 'insights_report';

exports.resolveTemplates = resolve;

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

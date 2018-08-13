'use strict';

const contentServer = require('../../connectors/contentServer');
const Resolution = require('../Resolution');
const Template = require('../../templates/Template');
const yaml = require('../../util/yaml');

const INSIGHTS_DIAGNOSIS_VAR_NAME = 'insights_report';

exports.resolveResolutions = async function (id) {
    const templates = await getTemplates(id);

    if (templates) {
        return templates.map(template => parseResolution(template, id));
    }
};

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

function parseResolution (template) {
    const play = template.play.replace('{{HOSTS}}', Template.HOSTS_PLACEHOLDER);
    const needsDiagnosis = yaml.isVariableUsed(INSIGHTS_DIAGNOSIS_VAR_NAME, play);
    return new Resolution(play, template.resolution_type, template.needs_reboot, needsDiagnosis);
}

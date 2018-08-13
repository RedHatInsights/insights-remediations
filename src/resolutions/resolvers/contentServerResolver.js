'use strict';

const contentServer = require('../../connectors/contentServer');
const Resolution = require('../Resolution');
const Template = require('../../templates/Template');
const yaml = require('../../util/yaml');

const INSIGHTS_DIAGNOSIS_VAR_NAME = 'insights_report';

exports.resolveResolutions = async function (id) {
    const templates = await contentServer.getResolutions(id.issue, true);
    return templates.map(template => parseResolution(template, id));
};

function parseResolution (template) {
    const play = template.play.replace('{{HOSTS}}', Template.HOSTS_PLACEHOLDER);
    const needsDiagnosis = yaml.isVariableUsed(INSIGHTS_DIAGNOSIS_VAR_NAME, play);
    return new Resolution(play, template.resolution_type, template.needs_reboot, needsDiagnosis);
}

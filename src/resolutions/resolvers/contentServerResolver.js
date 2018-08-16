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

function parseResolution (response) {
    let template = response.play.replace('{{HOSTS}}', Template.HOSTS_PLACEHOLDER);
    template = yaml.removeDocumentMarkers(template);
    const needsDiagnosis = yaml.isVariableUsed(INSIGHTS_DIAGNOSIS_VAR_NAME, template);
    return new Resolution(
        template,
        response.resolution_type,
        response.description,
        response.needs_reboot,
        needsDiagnosis,
        response.resolution_risk);
}

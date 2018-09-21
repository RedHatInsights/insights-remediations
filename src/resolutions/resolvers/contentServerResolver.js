'use strict';

const contentServer = require('../../connectors/contentServer');
const Resolution = require('../Resolution');
const Template = require('../../templates/Template');
const yaml = require('../../util/yaml');

const INSIGHTS_DIAGNOSIS_VAR_NAME = 'insights_report';
const INSIGHTS_REBOOT_VAR_NAME = 'insights_needs_reboot';

exports.resolveResolutions = async function (id) {
    const templates = await contentServer.getResolutions(id.issue, true);
    return templates.map(template => parseResolution(template, id));
};

function parseResolution (response) {
    // adds quotes around the placeholder regardless of whether the original template uses quotes or not
    let template = response.play.replace(/["]?{{HOSTS}}["]?/, `"${Template.HOSTS_PLACEHOLDER}"`);

    template = yaml.removeDocumentMarkers(template);

    const needsDiagnosis = yaml.isVariableUsed(INSIGHTS_DIAGNOSIS_VAR_NAME, template);
    const needsReboot = yaml.isVariableUsed(INSIGHTS_REBOOT_VAR_NAME, template);

    return new Resolution(
        template,
        response.resolution_type,
        response.description,
        needsReboot,
        needsDiagnosis,
        response.resolution_risk);
}

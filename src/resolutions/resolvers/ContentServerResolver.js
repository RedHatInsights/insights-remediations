'use strict';

const contentServer = require('../../connectors/contentServer');
const Resolution = require('../Resolution');
const Template = require('../../templates/Template');
const yaml = require('../../util/yaml');
const Resolver = require('./Resolver');

const INSIGHTS_DIAGNOSIS_VAR_NAME = 'insights_report';
const INSIGHTS_REBOOT_VAR_NAME = 'insights_needs_reboot';

module.exports = class ContentServerResolver extends Resolver {

    async resolveResolutions (id) {
        const templates = await contentServer.getResolutions(id.issue);
        return templates.map(template => parseResolution(template, id));
    }
};

function parseResolution (response) {
    // adds quotes around the placeholder regardless of whether the original template uses quotes or not
    // eslint rule suppressed because the input (playbook template) never comes from users
    // eslint-disable-next-line security/detect-unsafe-regex
    let template = response.play.replace(/("\s*)?{{\s*HOSTS\s*}}(\s*")?/, `"${Template.HOSTS_PLACEHOLDER}"`);

    template = yaml.removeDocumentMarkers(template);

    const needsDiagnosis = yaml.isVariableUsed(INSIGHTS_DIAGNOSIS_VAR_NAME, template);
    const needsReboot = yaml.isVariableUsed(INSIGHTS_REBOOT_VAR_NAME, template);

    return new Resolution(
        template,
        response.resolution_type,
        response.description,
        needsReboot,
        needsDiagnosis,
        response.resolution_risk,
        response.version);
}

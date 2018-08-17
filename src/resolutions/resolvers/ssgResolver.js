'use strict';

const yaml = require('js-yaml');
const ssg = require('../../connectors/ssg');
const keyValueParser = require('../../util/keyValueParser');
const Resolution = require('../Resolution');
const yamlUtils = require('../../util/yaml');
const { isNumber, isBoolean } = require('../../util/preconditions');

const LEVELS = {
    low: 1,
    medium: 2,
    high: 3
};

exports.resolveResolutions = async function (id) {
    const raw = await ssg.getTemplate(id.issue);

    if (!raw) {
        return [];
    }

    return [parseTemplate(raw, id)];
};

function parseTemplate (template, id) {
    template = template.replace(/@ANSIBLE_TAGS@/g, '- 0');
    template = yamlUtils.removeDocumentMarkers(template);
    const parsed = yaml.safeLoad(template);
    parsed.forEach(item => delete item.tags);

    const metadata = parseMetadata(template);
    const riskOfChange = parseRiskOfChange(metadata);
    const needsReboot = isBoolean(metadata.reboot);

    const play = createBaseTemplate(id);
    play.tasks = parsed;
    // TODO: add reboot trigger if needed

    return new Resolution(yaml.safeDump([play]).trim(), 'fix', `Fix`, needsReboot, false, riskOfChange);
}

function createBaseTemplate (id) {
    return {
        name: `fix ${id.issue}`,
        hosts: '@@HOSTS@@',
        become: true
    };
}

function parseMetadata (template) {
    const lines = template.split('\n').filter(line => line.startsWith('#'));
    return keyValueParser.parse(lines.join('\n'));
}

// TODO: this may need some tuning to align with how risk of change is computed for other types of resolutions
function parseRiskOfChange (metadata) {
    if (!metadata.disruption || !metadata.complexity) {
        return -1;
    }

    const disruption = isNumber(LEVELS[metadata.disruption]);
    const complexity = isNumber(LEVELS[metadata.complexity]);

    return disruption + (complexity === 1 ? 0 : 1);
}

'use strict';

const _ = require('lodash');
const yaml = require('js-yaml');
const ssg = require('../../connectors/ssg');
const keyValueParser = require('../../util/keyValueParser');
const Resolution = require('../Resolution');
const yamlUtils = require('../../util/yaml');
const { isBoolean, nonEmptyArray, notIn } = require('../../util/preconditions');
const templates = require('../../templates/static');
const Resolver = require('./Resolver');
const log = require('../../util/log');

const rebootFactSetter = yaml.safeLoad(templates.special.rebootFactSetter.data);

const PATTERN = /xccdf_org\.ssgproject\.content_rule_([a-z0-9_]+)/;

const DEFAULTS = Object.freeze({
    reboot: true
});

/*
const LEVELS = {
    low: 1,
    medium: 2,
    high: 3
};
*/

module.exports = class SSGResolver extends Resolver {
    async resolveResolutions (id) {
        const match = PATTERN.exec(id.issue);

        if (!match) {
            return [];
        }

        const raw = await ssg.getTemplate(match[1]);

        if (!raw) {
            return [];
        }

        const result = parseTemplate(raw, id);

        return result ? [result] : [];
    }
};

function parseTemplate (template, id) {
    template = template.replace(/@ANSIBLE_TAGS@/g, '- 0');
    template = template.replace(/^.*@ANSIBLE_ENSURE_PLATFORM@.*$/gm, ''); // TODO!!
    template = yamlUtils.removeDocumentMarkers(template);
    let parsed = false;

    try {
        parsed = yaml.safeLoad(template);
    } catch (e) {
        log.warn(e, `Error processing ssg template for ${id}`);
        return false;
    }

    if (parsed.length !== 1 || _.has(parsed[0], 'block')) {
        return false; // TODO: at this point we only support single-task resolutions
    }

    parsed.forEach(item => delete item.tags);

    const metadata = parseMetadata(template);
    const resolutionRisk = parseResolutionRisk(metadata);
    const needsReboot = isBoolean(metadata.reboot);

    if (needsReboot) {
        if (!addRebootSupport(parsed)) {
            return false;
        }
    }

    const name = parsed[0].name;

    const play = createBaseTemplate(name);
    play.tasks = parsed;

    let processedTemplate = false;
    try {
        processedTemplate = yaml.safeDump([play]).trim();
    } catch (e) {
        log.warn(e, `Error processing ssg template for ${id}`);
        return false;
    }

    return new Resolution(processedTemplate, 'fix', name, needsReboot, false, resolutionRisk);
}

function createBaseTemplate (name) {
    return {
        name,
        hosts: '@@HOSTS@@',
        become: true
    };
}

function parseMetadata (template) {
    const lines = template.split('\n').filter(line => line.startsWith('#'));
    const metadata = keyValueParser.parse(lines.join('\n'));
    return _.defaults(metadata, DEFAULTS);
}

// TODO: this may need some tuning to align with how risk of change is computed for other types of resolutions
function parseResolutionRisk () {
    /*
    if (!metadata.disruption || !metadata.complexity) {
        return -1;
    }

    const disruption = isNumber(LEVELS[metadata.disruption]);
    const complexity = isNumber(LEVELS[metadata.complexity]);

    return disruption + (complexity === 1 ? 0 : 1);
    */
    return -1; // TODO: revisit ^^^
}

function addRebootSupport (tasks) {
    nonEmptyArray(tasks);

    if (tasks.length !== 1) {
        return false; // TODO: this needs proper support
    }

    notIn(tasks[0], 'register');

    tasks[0].register = 'result';
    tasks.push(rebootFactSetter);

    return true;
}

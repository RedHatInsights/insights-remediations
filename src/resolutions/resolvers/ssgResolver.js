'use strict';

const yaml = require('js-yaml');
const ssg = require('../../connectors/ssg');
const keyValueParser = require('../../util/keyValueParser');
const Resolution = require('../Resolution');
const yamlUtils = require('../../util/yaml');

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

    const play = createBaseTemplate(id);
    play.tasks = parsed;
    // TODO: add reboot trigger if needed

    const metadata = parseMetadata(template);
    return new Resolution(yaml.safeDump([play]).trim(), 'fix', metadata.reboot);
}

function parseMetadata (template) {
    const lines = template.split('\n').filter(line => line.startsWith('#'));
    return keyValueParser.parse(lines.join('\n'));
}

function createBaseTemplate (id) {
    return {
        name: `fix ${id.issue}`,
        hosts: '@@HOSTS@@',
        become: true
    };
}

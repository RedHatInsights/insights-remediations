'use strict';

const yaml = require('js-yaml');
const ssg = require('../../connectors/ssg');
const keyValueParser = require('../../util/keyValueParser');
const Resolution = require('../Resolution');

exports.resolveResolution = async function (id) {
    const raw = await getTemplate(id);

    if (raw) {
        return parseTemplate(raw, id);
    }
};

async function getTemplate (id) {
    try {
        return await ssg.getTemplate(id.issue);
    } catch (e) {
        if (e.name === 'StatusCodeError' && e.statusCode === 404) {
            return;
        }

        throw e;
    }
}

function parseTemplate (template, id) {
    template = template.replace(/@ANSIBLE_TAGS@/g, '- 0');
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

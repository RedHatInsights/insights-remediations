'use strict';

const _ = require('lodash');
const P = require('bluebird');
const yaml = require('js-yaml');
const ssg = require('../../external/ssg');
const keyValueParser = require('../../util/keyValueParser');
const Template = require('../templates/Template');
const identifiers = require('../../util/identifiers');

const APP = 'compliance';

exports.resolveTemplates = async function (ids) {
    const filtered = ids.map(identifiers.parse).filter(id => id.app === APP);

    if (!filtered.length) {
        return {};
    }

    const pending = _(filtered)
    .keyBy(id => id.full)
    .mapValues(resolveTemplate)
    .value();

    const resolved = await P.props(pending);
    return _.pickBy(resolved);
};

async function resolveTemplate(id) {
    const raw = await getTemplate(id);

    if (!raw) {
        return;
    }

    return [parseTemplate(raw, id)];
}

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

    const play = createBaseTemplate(id.issue);
    play.tasks = parsed;
    // TODO: add reboot trigger if needed

    const metadata = parseMetadata(template);
    return new Template(yaml.safeDump([play]).trim(), 'fix', metadata.reboot);
}

function parseMetadata (template) {
    const lines = template.split('\n').filter(line => line.startsWith('#'));
    return keyValueParser.parse(lines.join('\n'));
}

function createBaseTemplate (id) {
    return {
        name: `fix ${id}`,
        hosts: '@@HOSTS@@',
        become: true
    };
}

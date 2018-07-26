'use strict';

const _ = require('lodash');
const P = require('bluebird');
const yaml = require('js-yaml');
const ssg = require('../../external/ssg');
const keyValueParser = require('../../util/keyValueParser');
const Template = require('../templates/Template');

const PREFIX = 'compliance:';

exports.resolveTemplates = async function (ids) {
    const filtered = ids.filter(id => id.startsWith(PREFIX));

    if (!filtered.length) {
        return {};
    }

    const pending = _(filtered)
    .keyBy()
    .mapValues(toExternalId)
    .mapValues(getTemplate)
    .value();

    const resolved = await P.props(pending);
    return _(resolved).pickBy().mapValues(parseTemplate).mapValues(template => ([template])).value();
};

async function getTemplate (id) {
    try {
        return await ssg.getTemplate(id);
    } catch (e) {
        if (e.name === 'StatusCodeError' && e.statusCode === 404) {
            return;
        }

        throw e;
    }
}

function toExternalId (id) {
    return id.replace(PREFIX, '');
}

function parseTemplate (template, id) {
    template = template.replace(/@ANSIBLE_TAGS@/g, '- 0');
    const parsed = yaml.safeLoad(template);
    parsed.forEach(item => delete item.tags);

    const play = createBaseTemplate(toExternalId(id));
    play.tasks = parsed;
    // TODO: add reboot trigger if needed

    const metadata = parseMetadata(template);
    return new Template(yaml.safeDump([play]).trim(), metadata.reboot);
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

'use strict';

const ssg = require('../../connectors/ssg');
const Resolver = require('./Resolver');
const Resolution = require('../Resolution');
const Template = require('../../templates/Template');
const yamlUtils = require('../../util/yaml');
const yaml = require('js-yaml');
const log = require('../../util/log');

const DEFAULT_NAME = 'Apply fix';
const PLACEHOLDER_REGEX = /(@([A-Z_])+@)/;

function getName (parsed) {
    if (parsed.tasks.length === 1) {
        return parsed.tasks[0].name;
    }

    return DEFAULT_NAME;
}

function testPlaceholders (raw) {
    const result = PLACEHOLDER_REGEX.exec(raw.replace('@@HOSTS@@', 'hosts'));

    if (result) {
        throw new Error(`Unresolved interpolation placeholder ${result[1]}`);
    }
}

module.exports = class SSGResolver extends Resolver {
    async resolveResolutions (id) {
        const raw = await ssg.getTemplate(id);

        if (!raw) {
            return [];
        }

        try {
            return [this.parseResolution(raw)];
        } catch (e) {
            log.warn(e, `Error processing ssg template for ${id}`);
            return [];
        }
    }

    parseResolution (raw) {
        raw = yamlUtils.removeDocumentMarkers(raw);
        const parsed = yaml.safeLoad(raw);

        testPlaceholders(raw);

        if (parsed.length !== 1) {
            throw new Error(`Unexpected number of plays: ${parsed.length}`);
        }

        const name = getName(parsed[0]);

        const template = new Template(yaml.safeDump(parsed));

        return new Resolution(template, 'fix', name, true);
    }
};

// TODO: reboot support

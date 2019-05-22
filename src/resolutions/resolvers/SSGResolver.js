'use strict';

const _ = require('lodash');
const P = require('bluebird');
const assert = require('assert');
const ssg = require('../../connectors/ssg');
const Resolver = require('./Resolver');
const Resolution = require('../Resolution');
const Template = require('../../templates/Template');
const yamlUtils = require('../../util/yaml');
const yaml = require('js-yaml');
const log = require('../../util/log');
const templates = require('../../templates/static');
const identifiers = require('../../util/identifiers');

const PLACEHOLDER_REGEX = /(@([A-Z_])+@)/;

const rebootHandler = yaml.safeLoad(templates.special.rebootHandler.data);
const HANDLER_ID = 'insights_reboot_handler';
const FALLBACK_PROFILE = 'all';

function testPlaceholders (raw) {
    const result = PLACEHOLDER_REGEX.exec(raw.replace('@@HOSTS@@', 'hosts'));

    if (result) {
        throw new Error(`Unresolved interpolation placeholder ${result[1]}`);
    }
}

function registerHandler (tasks) {
    tasks.forEach(task => {
        if (_.has(task, 'block')) {
            registerHandler(task.block);
        } else {
            assert(!_.has(task, 'notify'));
            task.notify = HANDLER_ID;
        }
    });
}

function processPlay (parsed) {
    if (!_.has(parsed[0], 'handlers')) {
        parsed[0].handlers = [];
    }

    registerHandler(parsed[0].tasks);

    parsed[0].handlers.push(rebootHandler);
    return parsed;
}

module.exports = class SSGResolver extends Resolver {
    async resolveResolutions (id) {
        const {platform, profile, rule} = identifiers.parseSSG(id);

        const [primary, fallback] = await P.all([
            ssg.getTemplate(platform, profile, rule),
            ssg.getTemplate(platform, FALLBACK_PROFILE, rule)
        ]);

        const raw = primary || fallback;

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

    parseResolution ({ version, template }) {
        template = yamlUtils.removeDocumentMarkers(template);
        version = version || 'unknown';
        const parsed = yaml.safeLoad(template);

        testPlaceholders(template);

        if (parsed.length !== 1) {
            throw new Error(`Unexpected number of plays: ${parsed.length}`);
        }

        const name = parsed[0].name;

        return new Resolution(
            new Template(yaml.safeDump(processPlay(parsed))),
            'fix',
            name,
            true,
            false,
            -1,
            version
        );
    }

    isRebootNeeded () {
        return true; // right now all SSG templates require reboot
    }
};

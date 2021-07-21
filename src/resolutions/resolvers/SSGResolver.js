'use strict';

const config = require('../../config');
const ssg = require('../../connectors/ssg');
const Resolver = require('./Resolver');
const Resolution = require('../Resolution');
const Template = require('../../templates/Template');
const yamlUtils = require('../../util/yaml');
const yaml = require('js-yaml');
const log = require('../../util/log');
const identifiers = require('../../util/identifiers');

const PLACEHOLDER_REGEX = /(@([A-Z_])+@)/;

function testPlaceholders (raw) {
    const result = PLACEHOLDER_REGEX.exec(raw.replace('@@HOSTS@@', 'hosts'));

    if (result) {
        throw new Error(`Unresolved interpolation placeholder ${result[1]}`);
    }
}

module.exports = class SSGResolver extends Resolver {
    async resolveResolutions (id) {
        const {platform, profile, rule} = identifiers.parseSSG(id);
        let raw = {};

        // RHCLOUD-4280: disable rule "rsyslog_remote_loghost"
        if (id.issue.includes('rsyslog_remote_loghost')) {return [];}

        if (config.ssg.impl === 'compliance') {
            raw = await ssg.getTemplate(id.issue);
        } else {
            raw = await ssg.getTemplate(platform, profile, rule);
        }

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
        const parsed = yaml.load(template);

        testPlaceholders(template);

        if (parsed.length !== 1) {
            throw new Error(`Unexpected number of plays: ${parsed.length}`);
        }

        const name = parsed[0].name;

        return new Resolution(
            new Template(template),
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

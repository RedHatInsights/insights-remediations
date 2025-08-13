'use strict';

const P = require('bluebird');
const config = require('../../config');
const ssg = require('../../connectors/ssg');
const Resolver = require('./Resolver');
const Resolution = require('../Resolution');
const Template = require('../../templates/Template');
const yamlUtils = require('../../util/yaml');
const yaml = require('js-yaml');
const log = require('../../util/log');
const identifiers = require('../../util/identifiers');
const errors = require('../../errors');

const PLACEHOLDER_REGEX = /(@([A-Z_])+@)/;
const FALLBACK_PROFILE = 'all';

function testPlaceholders (raw) {
    const result = PLACEHOLDER_REGEX.exec(raw.replace('@@HOSTS@@', 'hosts'));

    if (result) {
        throw new Error(`Unresolved interpolation placeholder ${result[1]}`);
    }
}

module.exports = class SSGResolver extends Resolver {
    async resolveResolutions (id) {
        const {platform, profile, rule, ssgVersion} = identifiers.parseSSG(id);
        let raw = {};

        log.debug(`Resolving SSG issue: ${id.issue}`);
        log.debug(`Parsed ID -> platform: ${platform}, profile: ${profile}, rule: ${rule}`);

        // Compliance API v1 is deprecated: require v2 SSG issue format with ssgVersion
        if (!ssgVersion) {
            const ruleRef = `xccdf_org.ssgproject.content_rule_${rule}`;
            throw new errors.BadRequest(
                'INVALID_ISSUE_IDENTIFIER',
                `Compliance v1 issue identifiers have been retired. Please update your v1 issue ID, "ssg:<platform>|<profile>|${ruleRef}", to the v2 format of "ssg:xccdf_org.ssgproject.content_benchmark_RHEL-X|<version>|<profile>|${ruleRef}"`
            );
        }

        // RHCLOUD-4280: disable rule "rsyslog_remote_loghost"
        if (id.issue.includes('rsyslog_remote_loghost')) {return [];}

        if (config.ssg.impl === 'compliance') {
            raw = await ssg.getTemplate(id.issue);
        } else {
            const [primary, fallback] = await P.all([
                ssg.getTemplate(platform, profile, rule),
                ssg.getTemplate(platform, FALLBACK_PROFILE, rule)
            ]);

            raw = primary || fallback;
        }

        if (!raw) {
            log.warn(`No template found for SSG issue: ${id.issue}`);
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

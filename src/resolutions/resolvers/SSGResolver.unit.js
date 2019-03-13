'use strict';

require('../../test');
const resolver = new(require('./SSGResolver'))();
const identifiers = require('../../util/identifiers');
const ssg = require('../../connectors/ssg/mock');

describe('SSGResolved', function () {
    test('detects unresolved interpolation placeholder', async () => {
        const id = identifiers.parse('ssg:rhel7|pci-dss|xccdf_org.ssgproject.content_rule_disable_prelink-unresolved');
        const resolutions = (await resolver.resolveResolutions(id));
        resolutions.should.be.empty();

        const template = await ssg.getTemplate(id);
        expect(() => resolver.parseResolution(template)).toThrow('Unresolved interpolation placeholder @RULE_TITLE@');
    });

    test('resolves the name for simple plays', async () => {
        const id = identifiers.parse('ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_service_rsyslog_enabled');
        const resolutions = (await resolver.resolveResolutions(id));
        resolutions.should.have.size(1);
        resolutions[0].description.should.equal('Enable service rsyslog');
    });

    test('falls back to default name for more complex plays', async () => {
        const id = identifiers.parse('ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_service_autofs_disabled');
        const resolutions = (await resolver.resolveResolutions(id));
        resolutions.should.have.size(1);
        resolutions[0].description.should.equal('Apply fix');
    });
});


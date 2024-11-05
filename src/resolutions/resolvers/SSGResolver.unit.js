'use strict';

require('../../test');
const resolver = new(require('./SSGResolver'))();
const identifiers = require('../../util/identifiers');
const ssg = require('../../connectors/ssg/mock');

const REQ = {
    headers: {
        'x-rh-identity': 'identity',
        'x-rh-insights-request-id': 'request-id'
    },
    identity: { type: 'test' },
    user: { username: 'test', account_number: 'test' }
};

describe('SSGResolved', function () {
    describe('impl', function () {
        test('detects unresolved interpolation placeholder', async () => {
            const id = identifiers.parse(REQ, 'ssg:rhel7|pci-dss|xccdf_org.ssgproject.content_rule_disable_prelink-unresolved');
            const resolutions = (await resolver.resolveResolutions(REQ, id));
            resolutions.should.be.empty();

            const template = await ssg.getTemplate(REQ, 'rhel7', 'pci-dss', 'disable_prelink-unresolved');
            expect(() => resolver.parseResolution(template)).toThrow('Unresolved interpolation placeholder @RULE_TITLE@');
        });

        test('resolves the name for simple plays', async () => {
            const id = identifiers.parse(REQ, 'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_service_rsyslog_enabled');
            const resolutions = (await resolver.resolveResolutions(REQ, id));
            resolutions.should.have.size(1);
            resolutions[0].description.should.equal('Enable rsyslog Service');
        });

        test('falls back to default name for more complex plays', async () => {
            const id = identifiers.parse(REQ, 'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_service_autofs_disabled');
            const resolutions = (await resolver.resolveResolutions(REQ, id));
            resolutions.should.have.size(1);
            resolutions[0].description.should.equal('Disable the Automounter');
        });

        test('falls back to all profile if the rule does not belong to the spefified profile', async () => {
            const id = identifiers.parse(REQ, 'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_disable_prelink');
            const resolutions = (await resolver.resolveResolutions(REQ, id));
            resolutions.should.have.size(1);
            resolutions[0].description.should.equal('Disable Prelinking');
        });

        test('returns 0 if the rule does not exist at all', async () => {
            const id = identifiers.parse(REQ, 'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_this_is_nonsense');
            const resolutions = (await resolver.resolveResolutions(REQ, id));
            resolutions.should.have.size(0);
        });

        test('returns 0 if the rule id is rsyslog_remote_loghost', async () => {
            const id = identifiers.parse(REQ, 'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_rsyslog_remote_loghost');
            const resolutions = (await resolver.resolveResolutions(REQ, id));
            resolutions.should.have.size(0);
        });
    });
});


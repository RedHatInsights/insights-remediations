'use strict';

const { request } = require('../test');

describe('resolve compliance resolutions', function () {
    test('resolution info (1)', async () => {
        const {body} = await request
        .get('/v1/resolutions/compliance:xccdf_org.ssgproject.content_rule_sshd_disable_root_login')
        .expect(200);

        body.should.eql({
            id: 'compliance:xccdf_org.ssgproject.content_rule_sshd_disable_root_login',
            resolution_risk: -1,
            resolutions: [{
                description: 'Disable SSH Root Login',
                id: 'fix',
                needs_reboot: false,
                resolution_risk: -1
            }]
        });
    });

    test('resolution info', async () => {
        const {body} = await request
        .get('/v1/resolutions/compliance:xccdf_org.ssgproject.content_rule_security_patches_up_to_date')
        .expect(200);

        body.should.eql({
            id: 'compliance:xccdf_org.ssgproject.content_rule_security_patches_up_to_date',
            resolution_risk: -1,
            resolutions: [{
                description: 'Security patches are up to date',
                id: 'fix',
                needs_reboot: true,
                resolution_risk: -1
            }]
        });
    });

    test('template with reboot and multiple tasks not supported at the moment', async () => {
        await request
        .get('/v1/resolutions/compliance:xccdf_org.ssgproject.content_rule_grub2_disable_interactive_boot')
        .expect(404);
    });

    test('template with multiple tasks not supported at the moment', async () => {
        await request
        .get('/v1/resolutions/compliance:xccdf_org.ssgproject.content_rule_no_empty_passwords')
        .expect(404);
    });
});

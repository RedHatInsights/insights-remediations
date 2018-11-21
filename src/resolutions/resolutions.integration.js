'use strict';

const { request } = require('../test');

describe('resolve compliance resolutions', function () {
    test('resolution info (1)', async () => {
        const {body} = await request
        .get('/v1/resolutions/compliance:sshd_disable_root_login')
        .expect(200);

        body.should.eql({
            id: 'compliance:sshd_disable_root_login',
            resolution_risk: 1,
            resolutions: [{
                description: 'Fix',
                id: 'fix',
                needs_reboot: false,
                resolution_risk: 1
            }]
        });
    });

    test('resolution info', async () => {
        const {body} = await request
        .get('/v1/resolutions/compliance:security_patches_up_to_date')
        .expect(200);

        body.should.eql({
            id: 'compliance:security_patches_up_to_date',
            resolution_risk: 3,
            resolutions: [{
                description: 'Fix',
                id: 'fix',
                needs_reboot: true,
                resolution_risk: 3
            }]
        });
    });
});

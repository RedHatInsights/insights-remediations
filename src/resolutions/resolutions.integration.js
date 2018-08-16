'use strict';

const { request } = require('../test');

describe('resolve compliance resolutions', function () {
    test('resolution info', async () => {
        const {body} = await request
        .get('/v1/resolutions/compliance:sshd_disable_root_login')
        .expect(200);

        body.should.eql({
            id: 'compliance:sshd_disable_root_login',
            riskOfChange: -1,
            resolutions: [{
                description: 'Fix',
                id: 'fix',
                needsReboot: false,
                riskOfChange: -1
            }]
        });
    });
});

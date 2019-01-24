'use strict';

const { request } = require('../test');

describe('resolve test resolutions', function () {
    test('resolution info (1)', async () => {
        const {body} = await request
        .get('/v1/resolutions/test:ping')
        .expect(200);

        body.should.eql({
            id: 'test:ping',
            resolution_risk: -1,
            resolutions: [{
                description: 'Ping',
                id: 'fix',
                needs_reboot: false,
                resolution_risk: -1
            }]
        });
    });

    test('resolution info (2)', async () => {
        const {body} = await request
        .get('/v1/resolutions/test:reboot')
        .expect(200);

        body.should.eql({
            id: 'test:reboot',
            resolution_risk: 4,
            resolutions: [{
                description: 'Reboot system',
                id: 'fix',
                needs_reboot: true,
                resolution_risk: 4
            }]
        });
    });

    test('resolution info (3)', async () => {
        const {body} = await request
        .get('/v1/resolutions/test:debug')
        .expect(200);

        body.should.eql({
            id: 'test:debug',
            resolution_risk: 1,
            resolutions: [{
                description: 'Ping once',
                id: 'fix',
                needs_reboot: false,
                resolution_risk: 1
            }, {
                description: 'Ping twice',
                id: 'alternative',
                needs_reboot: false,
                resolution_risk: 2
            }]
        });
    });
});

describe('resolve vulnerabilities resolutions', function () {
    test('erratum resolution info', async () => {
        const {body} = await request
        .get('/v1/resolutions/vulnerabilities:RHSA-2018:0007')
        .expect(200);

        body.should.eql({
            id: 'vulnerabilities:RHSA-2018:0007',
            resolution_risk: -1,
            resolutions: [{
                description: 'Upgrade packages affected by RHSA-2018:0007',
                id: 'fix',
                needs_reboot: true,
                resolution_risk: -1
            }]
        });
    });

    test('rule-based resolution info', async () => {
        const {body} = await request
        .get('/v1/resolutions/vulnerabilities:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074')
        .expect(200);

        body.should.eql({
            id: 'vulnerabilities:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074',
            resolution_risk: 3,
            resolutions: [{
                description: 'Update system to the latest kernel and reboot',
                id: 'kernel_update',
                needs_reboot: true,
                resolution_risk: 3
            }, {
                description: 'Disable DCCP kernel module',
                id: 'mitigate',
                needs_reboot: true,
                resolution_risk: 3
            }, {
                description: 'Make sure SELinux is enabled, enforcing and has selinux-policy-3.13.1-81.el7 or later on RHEL7',
                id: 'selinux_mitigate',
                needs_reboot: true,
                resolution_risk: 3
            }]
        });
    });
});

describe('resolve advisor resolutions', function () {
    test('resolution info', async () => {
        const {body} = await request
        .get('/v1/resolutions/advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE')
        .expect(200);

        body.should.eql({
            id: 'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE',
            resolution_risk: 3,
            resolutions: [{
                description: 'Correct Bonding Config Items',
                id: 'fix',
                needs_reboot: false,
                resolution_risk: 3
            }]
        });
    });
});

describe('batch', function () {
    test('400s on empty list', async () => {
        await request
        .post('/v1/resolutions')
        .send({ issues: [] })
        .expect(400);
    });

    test('template batch resource', async () => {
        const { body } = await request
        .post('/v1/resolutions')
        .send({
            issues: [
                'test:ping',
                'vulnerabilities:CVE-2017-15126',
                'vulnerabilities:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074',
                'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE',
                'advisor:non-existent-issue'
            ]
        })
        .expect(200);
        expect(body).toMatchSnapshot();
    });
});

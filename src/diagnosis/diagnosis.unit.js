'use strict';

const { request } = require('../test');

describe('/diagnosis', function () {
    test('returns all diagnosis information for the given system', async () => {
        const {body} = await request
        .get('/v1/diagnosis/9a212816-a472-11e8-98d0-529269fb1459')
        .expect(200);
        body.should.have.key('diagnosis');
        body.diagnosis.should.have.size(2);
        body.diagnosis.should.have.key('CVE_2018_1111_dhcp|ERROR_CVE_2018_1111_DHCP_2');
        body.diagnosis.should.have.key('CVE_2017_5753_4_cpu_kernel|KERNEL_CVE_2017_5753_4_CPU_ERROR_3');
    });

    test('returns diagnosis information with remediation hint', async () => {
        const {body} = await request
        .get('/v1/diagnosis/9a212816-a472-11e8-98d0-529269fb1459?remediation=3261100e-2103-49de-8f15-d2d0365c5048')
        .expect(200);
        body.should.have.key('diagnosis');
        body.diagnosis.should.have.size(1);
        body.diagnosis.should.have.key('CVE_2018_1111_dhcp|ERROR_CVE_2018_1111_DHCP_2');
    });
});

'use strict';

const { request, auth } = require('../test');

describe('diagnosis contract test', function () {
    test('returns all details for a given system', async () => {
        const {body} = await request
        .get('/v1/diagnosis/1897053e-4bdc-47eb-954e-9c4ecd6b509f')
        .set(auth.jhartingCert)
        .expect(200);

        body.should.have.property('id', 'aab9caf3-7bcb-40ed-bcb1-92fc6360a47d');
        body.should.have.property('insights_id', '1897053e-4bdc-47eb-954e-9c4ecd6b509f');
        body.should.have.property('details');
        Object.keys(body.details).length.should.be.above(3);

        body.details.should.have.property('CVE_2017_smbloris_samba|SAMBA_CVE_2017_SMBLORIS_2');
        body.details['CVE_2017_smbloris_samba|SAMBA_CVE_2017_SMBLORIS_2'].rhel_version.should.equal(7);
        body.details['CVE_2017_smbloris_samba|SAMBA_CVE_2017_SMBLORIS_2'].samba_config_info.should.be.true();
    });
});

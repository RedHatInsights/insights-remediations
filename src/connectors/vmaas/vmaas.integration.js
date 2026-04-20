'use strict';

require('../../test');
const vmaas = require('../vmaas');
const { mockRequest } = require('../testUtils');

test('obtains erratum metadata', async () => {
    const testReq = mockRequest();
    const result = await vmaas.getCve(testReq, 'CVE-2017-17712');
    result.should.have.property('synopsis', 'CVE-2017-17712');
    result.should.have.property('impact', 'Important');
});


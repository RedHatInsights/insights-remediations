'use strict';

require('../../test');
const vmaas = require('../vmaas');
const { mockRequest } = require('../testUtils');

const REQ = {
    headers: {
        'x-rh-identity': 'identity',
        'x-rh-insights-request-id': 'request-id'
    },
    identity: { type: 'test' },
    user: { username: 'test', account_number: 'test' }
};

test('obtains erratum metadata', async () => {
    mockRequest();
    const result = await vmaas.getCve(REQ, 'CVE-2017-17712');
    result.should.have.property('synopsis', 'CVE-2017-17712');
    result.should.have.property('impact', 'Important');
});


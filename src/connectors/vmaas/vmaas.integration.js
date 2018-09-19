'use strict';

require('../../test');
const vmaas = require('../vmaas');

test('obtains erratum metadata', async () => {
    const result = await vmaas.getCve('CVE-2017-17712');
    result.should.have.property('synopsis', 'CVE-2017-17712');
    result.should.have.property('impact', 'Important');
});


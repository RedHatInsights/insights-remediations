'use strict';

require('../../test');
const vmaas = require('../vmaas');

test('obtains erratum metadata', async () => {
    const result = await vmaas.getErrata(['RHSA-2018:0502']);
    result.should.have.key('RHSA-2018:0502');
});

test('obtains errata metadata', async () => {
    const result = await vmaas.getErrata(['RHSA-2018:0502', 'RHSA-2018:0504']);
    result.should.have.keys('RHSA-2018:0502', 'RHSA-2018:0504');
});

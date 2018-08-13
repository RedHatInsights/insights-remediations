'use strict';

require('../../test');
const vmaas = require('../vmaas');

test('obtains erratum metadata', async () => {
    const result = await vmaas.getErratum('RHSA-2018:0502');
    result.should.have.property('synopsis', 'Important: kernel-alt security and bug fix update');
});


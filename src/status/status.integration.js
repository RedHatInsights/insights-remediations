'use strict';

const { request } = require('../test');

test('provides status information', async () => {
    const {body} = await request
    .get('/v1/status')
    .expect(200);

    body.should.containEql({
        advisor: 'ok',
        compliance: 'ok',
        contentServer: 'ok',
        inventory: 'ok',
        ssg: 'ok',
        vmaas: 'ok',
        vulnerabilities: 'ok'
    });

    body.should.have.key('httpCache');
    body.httpCache.should.have.keys('hits', 'misses');
});

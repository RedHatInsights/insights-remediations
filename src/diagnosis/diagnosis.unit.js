'use strict';

const { request } = require('../test');

describe('/diagnosis', function () {
    test('returns diagnosis', async () => {
        const {body} = await request
        .get('/v1/diagnosis/9a212816-a472-11e8-98d0-529269fb1459')
        .expect(200);
        body.should.have.key('diagnosis');
    });
});

'use strict';

const _ = require('lodash');
const { request, reqId } = require('./test');

describe('API tests', function () {

    test('gracefully handles payloads too large', async () => {
        const {id, header} = reqId();
        const data = {
            issues: [{
                id: 'test:ping',
                systems: _.times(1000000, '68799a02-8be9-11e8-9eb6-529269fb1459')
            }]
        };

        const { body } = await request
        .post('/v1/playbook')
        .set(header)
        .send(data)
        .expect(413);

        body.errors.should.eql([{
            id,
            status: 413,
            code: 'entity.too.large',
            title: 'Entity too large'
        }]);
    });
});

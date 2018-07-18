'use strict';

const { request } = require('../test');

describe('Generator', () => {

    it('returns a playbook', () => {
        const data = {
            issues: [{
                id: 'vulnerabilities:CVE_2017_5461_nss|CVE_2017_5461_NSS_2',
                systems: ['a8799a02-8be9-11e8-9eb6-529269fb1459']
            }]
        };

        return request
        .post('/v1/playbook')
        .send(data)
        .expect(200)
        .then(({body}) => {
            body.should.eql(data);
        });
    });

    it('400s on invalid body parameters', () => {
        return request
        .post('/v1/playbook')
        .send({})
        .expect(400)
        .then(({body}) => {
            body.should.have.property('error', {
                code: 'OBJECT_MISSING_REQUIRED_PROPERTY',
                message: 'Missing required property: issues'
            });
        });
    });

    it('400s on empty system list', () => {
        return request
        .post('/v1/playbook')
        .send({
            issues: [{
                id: 'vulnerabilities:CVE_2017_5461_nss|CVE_2017_5461_NSS_2',
                systems: []
            }]
        })
        .expect(400)
        .then(({body}) => {
            body.should.have.property('error', {
                code: 'ARRAY_LENGTH_SHORT',
                message: 'Array is too short (0), minimum 1'
            });
        });
    });
});

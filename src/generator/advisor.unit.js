'use strict';

const { request } = require('../test');

test('generates a rule-based playbook', () => {
    const data = {
        issues: [{
            id: 'advisor:bond_config_issue|BOND_CONFIG_ISSUE',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    };

    return request
    .post('/v1/playbook')
    .send(data)
    .expect(200)
    .then(res => expect(res.text).toMatchSnapshot());
});

test('400s on unknown issue id', () => {
    return request
    .post('/v1/playbook')
    .send({
        issues: [{
            id: 'advisor:nonExistentId',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    })
    .expect(400)
    .then(({ body }) => {
        body.should.have.property('error', {
            code: 'UNKNOWN_ISSUE',
            message: 'Unknown issue identifier "advisor:nonExistentId"'
        });
    });
});

test('400s on unsupported issue', () => {
    return request
    .post('/v1/playbook')
    .send({
        issues: [{
            id: 'advisor:alias_interface_invalid|ALIAS_INTERFACE_INVALID',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    })
    .expect(400)
    .then(({ body }) => {
        body.should.have.property('error', {
            code: 'UNSUPPORTED_ISSUE',
            message: 'Issue "advisor:alias_interface_invalid|ALIAS_INTERFACE_INVALID" does not have Ansible support'
        });
    });
});

test('puts quotes around hosts list', async () => {
    const {text} = await request
    .post('/v1/playbook')
    .send({
        issues: [{
            id: 'advisor:bond_config_issue|NO_QUOTES',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    }).expect(200);

    expect(text).toMatchSnapshot();
});

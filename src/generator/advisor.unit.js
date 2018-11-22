'use strict';

const { request, reqId } = require('../test');

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
    const {id, header} = reqId();

    return request
    .post('/v1/playbook')
    .set(header)
    .send({
        issues: [{
            id: 'advisor:nonExistentId',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    })
    .expect(400)
    .then(({ body }) => {
        body.errors.should.eql([{
            id,
            status: 400,
            code: 'UNKNOWN_ISSUE',
            title: 'Unknown issue identifier "advisor:nonExistentId"'
        }]);
    });
});

test('400s on unsupported issue', () => {
    const {id, header} = reqId();

    return request
    .post('/v1/playbook')
    .set(header)
    .send({
        issues: [{
            id: 'advisor:alias_interface_invalid|ALIAS_INTERFACE_INVALID',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    })
    .expect(400)
    .then(({ body }) => {
        body.errors.should.eql([{
            id,
            status: 400,
            code: 'UNSUPPORTED_ISSUE',
            title: 'Issue "advisor:alias_interface_invalid|ALIAS_INTERFACE_INVALID" does not have Ansible support'
        }]);
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

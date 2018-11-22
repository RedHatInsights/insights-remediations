'use strict';

const { request, reqId } = require('../test');

test('generates a simple playbook with single compliance remediation', async () => {
    const data = {
        issues: [{
            id: 'compliance:sshd_disable_root_login',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    };

    const res = await request
    .post('/v1/playbook')
    .send(data)
    .expect(200);
    expect(res.text).toMatchSnapshot();
});

test('generates a simple playbook with multiple compliance remediation', async () => {
    const data = {
        issues: [{
            id: 'compliance:no_empty_passwords',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }, {
            id: 'compliance:bootloader_audit_argument',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    };

    const res = await request
    .post('/v1/playbook')
    .send(data)
    .expect(200);
    expect(res.text).toMatchSnapshot();
});

test('generates a simple playbook with reboot support', async () => {
    const data = {
        issues: [{
            id: 'compliance:security_patches_up_to_date',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    };

    const res = await request
    .post('/v1/playbook')
    .send(data)
    .expect(200);
    expect(res.text).toMatchSnapshot();
});

test('400s on unknown resolution type', () => {
    const {id, header} = reqId();

    return request
    .post('/v1/playbook')
    .set(header)
    .send({
        issues: [{
            id: 'compliance:non-existing-issue',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    })
    .expect(400)
    .then(({ body }) => {
        body.errors.should.eql([{
            id,
            status: 400,
            code: 'UNSUPPORTED_ISSUE',
            title: 'Issue "compliance:non-existing-issue" does not have Ansible support'
        }]);
    });
});

test('400s on unknown resolution type other than fix', () => {
    const {id, header} = reqId();

    return request
    .post('/v1/playbook')
    .set(header)
    .send({
        issues: [{
            id: 'compliance:sshd_disable_root_login',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459'],
            resolution: 'non-existing-resolution'
        }]
    })
    .expect(400)
    .then(({ body }) => {
        body.errors.should.eql([{
            id,
            status: 400,
            code: 'UNKNOWN_RESOLUTION',
            title: 'Issue "compliance:sshd_disable_root_login"' +
                ' does not have Ansible resolution "non-existing-resolution"'
        }]);
    });
});


'use strict';

const { request } = require('../test');

test('generates a simple playbook with single compliance remediation', async () => {
    const data = {
        issues: [{
            id: 'compliance:sshd_disable_root_login',
            systems: ['a8799a02-8be9-11e8-9eb6-529269fb1459']
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
            systems: ['a8799a02-8be9-11e8-9eb6-529269fb1459']
        }, {
            id: 'compliance:bootloader_audit_argument',
            systems: ['a8799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    };

    const res = await request
    .post('/v1/playbook')
    .send(data)
    .expect(200);
    expect(res.text).toMatchSnapshot();
});


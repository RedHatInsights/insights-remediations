'use strict';

const { request, reqId } = require('../test');

test('generates a simple playbook with single compliance remediation', async () => {
    const data = {
        issues: [{
            id: 'compliance:xccdf_org.ssgproject.content_rule_sshd_disable_root_login',
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
            id: 'compliance:xccdf_org.ssgproject.content_rule_sshd_disable_root_login',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }, {
            id: 'compliance:xccdf_org.ssgproject.content_rule_security_patches_up_to_date',
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
            id: 'compliance:xccdf_org.ssgproject.content_rule_security_patches_up_to_date',
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
            id: 'compliance:xccdf_org.ssgproject.content_rule_non-existing-issue',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    })
    .expect(400)
    .then(({ body }) => {
        body.errors.should.eql([{
            id,
            status: 400,
            code: 'UNKNOWN_ISSUE',
            title: 'Unknown issue identifier "compliance:xccdf_org.ssgproject.content_rule_non-existing-issue"'
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
            id: 'compliance:xccdf_org.ssgproject.content_rule_sshd_disable_root_login',
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
            title: 'Issue "compliance:xccdf_org.ssgproject.content_rule_sshd_disable_root_login"' +
                ' does not have Ansible resolution "non-existing-resolution"'
        }]);
    });
});


'use strict';

const { request, reqId } = require('../test');

test('generates a rule-based playbook', () => {
    const data = {
        issues: [{
            id: 'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    };

    return request
    .post('/v1/playbook')
    .send(data)
    .expect(200)
    .then(res => expect(res.text).toMatchSnapshot());
});

test('generates a rule-based playbook with resolution preference', () => {
    const data = {
        issues: [{
            id: 'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459'],
            resolution: 'selinux_mitigate'
        }]
    };

    return request
    .post('/v1/playbook')
    .send(data)
    .expect(200)
    .then(res => expect(res.text).toMatchSnapshot());
});

test('400s on unknown resolution type', () => {
    const {id, header} = reqId();

    return request
    .post('/v1/playbook')
    .set(header)
    .send({
        issues: [{
            id: 'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074',
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
            title: 'Issue "advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074"' +
                ' does not have Ansible resolution "non-existing-resolution"'
        }]);
    });
});

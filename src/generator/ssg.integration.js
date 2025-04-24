'use strict';
/*eslint-disable max-len*/

const { request, reqId, normalizePlaybookVersionForSnapshot } = require('../test');

test('generates a simple playbook with single compliance remediation (Compliance API v1 issue id format)', async () => {
    const data = {
        issues: [{
            id: 'ssg:rhel7|pci-dss|xccdf_org.ssgproject.content_rule_disable_prelink',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    };

    const res = await request
    .post('/v1/playbook')
    .send(data)
    .expect(200);
    expect(normalizePlaybookVersionForSnapshot(res.text)).toMatchSnapshot();
});

test('generates a simple playbook with single compliance remediation (Compliance API v2 issue id format)', async () => {
    const data = {
        issues: [{
            id: 'ssg:xccdf_org.ssgproject.content_benchmark_RHEL-7|1.0.0|pci-dss|xccdf_org.ssgproject.content_rule_disable_prelink',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    };

    const res = await request
    .post('/v1/playbook')
    .send(data)
    .expect(200);
    expect(normalizePlaybookVersionForSnapshot(res.text)).toMatchSnapshot();
});

test('generates a simple playbook with multiple compliance remediation', async () => {
    const data = {
        issues: [{
            id: 'ssg:rhel7|pci-dss|xccdf_org.ssgproject.content_rule_disable_prelink',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }, {
            id: 'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_service_rsyslog_enabled',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    };

    const res = await request
    .post('/v1/playbook')
    .send(data)
    .expect(200);
    expect(normalizePlaybookVersionForSnapshot(res.text)).toMatchSnapshot();
});

test('400s on unknown issue id', () => {
    const {id, header} = reqId();

    return request
    .post('/v1/playbook')
    .set(header)
    .send({
        issues: [{
            id: 'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_non-existing-issue',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    })
    .expect(400)
    .then(({ body }) => {
        body.errors.should.eql([{
            id,
            status: 400,
            code: 'UNKNOWN_ISSUE',
            title: 'Unknown issue identifier "ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_non-existing-issue"'
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
            id: 'ssg:rhel7|pci-dss|xccdf_org.ssgproject.content_rule_disable_prelink',
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
            title: 'Issue "ssg:rhel7|pci-dss|xccdf_org.ssgproject.content_rule_disable_prelink"' +
                ' does not have Ansible resolution "non-existing-resolution"'
        }]);
    });
});

test('400s on rsyslog_remote_loghost rules for compliance remediations', async () => {
    const {id, header} = reqId();

    const data = {
        issues: [{
            id: 'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_rsyslog_remote_loghost',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    };

    return request
    .post('/v1/playbook')
    .set(header)
    .send(data)
    .expect(400)
    .then(({ body }) => {
        body.errors.should.eql([{
            id,
            status: 400,
            code: 'UNSUPPORTED_ISSUE',
            title: 'Issue "ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_rsyslog_remote_loghost" does not have Ansible support'
        }]);
    });
});

test('generates a playbook with block', async () => {
    const data = {
        issues: [{
            id: 'ssg:rhel7|ospp|xccdf_org.ssgproject.content_rule_mount_option_dev_shm_nodev',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    };

    const res = await request
    .post('/v1/playbook')
    .send(data)
    .expect(200);
    expect(normalizePlaybookVersionForSnapshot(res.text)).toMatchSnapshot();
});

test('generates a simple playbook with uppercase profile name', async () => {
    const data = {
        issues: [{
            id: 'ssg:rhel7|C2S|xccdf_org.ssgproject.content_rule_disable_host_auth',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    };

    const res = await request
    .post('/v1/playbook')
    .send(data)
    .expect(200);
    expect(normalizePlaybookVersionForSnapshot(res.text)).toMatchSnapshot();
});


'use strict';

const base = require('../test');
const version = require('../util/version');
const { request } = base;

test('generates a simple playbook with single RHSA remediation', async () => {
    const data = {
        issues: [{
            id: 'vulnerabilities:RHSA-2018:0502',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    };

    const res = await request
    .post('/v1/playbook')
    .send(data)
    .expect(200);
    expect(res.text).toMatchSnapshot();
});

test('generates a simple playbook with single CVE remediation', async () => {
    base.sandbox.stub(version, 'commit').value('test-version');

    const data = {
        issues: [{
            id: 'vulnerabilities:CVE-2017-17712',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    };

    const res = await request
    .post('/v1/playbook')
    .send(data)
    .expect(200);
    expect(res.text).toMatchSnapshot();
});

test('generates a simple playbook with multiple erratum-based remediation', async () => {
    const data = {
        issues: [{
            id: 'vulnerabilities:RHSA-2018:0502',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }, {
            id: 'vulnerabilities:CVE-2017-17712',
            systems: ['53fbcd90-9c8f-11e8-98d0-529269fb1459']
        }]
    };

    const res = await request
    .post('/v1/playbook')
    .send(data)
    .expect(200);
    expect(res.text).toMatchSnapshot();
});

test('aggregates multiple errata into a single play', async () => {
    const data = {
        issues: [{
            id: 'vulnerabilities:RHSA-2018:0502',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }, {
            id: 'vulnerabilities:RHSA-2017:1852',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }, {
            id: 'vulnerabilities:RHSA-2017:1382',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }, {
            id: 'vulnerabilities:RHSA-2017:2679',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    };

    const res = await request
    .post('/v1/playbook')
    .send(data)
    .expect(200);
    expect(res.text).toMatchSnapshot();
});

test('aggregates multiple errata-based issues into advisory/cve plays', async () => {
    base.sandbox.stub(version, 'commit').value('test-version');

    const data = {
        issues: [{
            id: 'vulnerabilities:RHSA-2018:0502',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }, {
            id: 'vulnerabilities:RHSA-2017:1852',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }, {
            id: 'vulnerabilities:RHSA-2017:1382',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }, {
            id: 'vulnerabilities:RHSA-2017:2679',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }, {
            id: 'vulnerabilities:CVE-2017-5715',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }, {
            id: 'vulnerabilities:CVE-2017-17712',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    };

    const res = await request
    .post('/v1/playbook')
    .send(data)
    .expect(200);
    expect(res.text).toMatchSnapshot();
});

test('400s on unknown issue', () => {
    const {id, header} = base.reqId();

    return request
    .post('/v1/playbook')
    .set(header)
    .send({
        issues: [{
            id: 'vulnerabilities:RHSA-2018:99999',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    })
    .expect(400)
    .then(({ body }) => {
        body.errors.should.eql([{
            id,
            status: 400,
            code: 'UNKNOWN_ISSUE',
            title: 'Unknown issue identifier "vulnerabilities:RHSA-2018:99999"'
        }]);
    });
});

test('400s on unknown resolution type other than fix', () => {
    const {id, header} = base.reqId();

    return request
    .post('/v1/playbook')
    .set(header)
    .send({
        issues: [{
            id: 'vulnerabilities:RHSA-2018:0502',
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
            title: 'Issue "vulnerabilities:RHSA-2018:0502"' +
                ' does not have Ansible resolution "non-existing-resolution"'
        }]);
    });
});

'use strict';

const base = require('../test');
const { request } = base;

describe('patchman', function () {
    test('generates a simple playbook with single patchman advisory remediation', async () => {
        const data = {
            issues: [{
                id: 'patch-advisory:RHBA-2019:4105',
                systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
            }]
        };

        const res = await request
        .post('/v1/playbook')
        .send(data)
        .expect(200);

        expect(res.text).toMatchSnapshot();
    });

    test('generates a simple playbook with multiple patchman advisory remediations', async () => {
        const data = {
            issues: [{
                id: 'patch-advisory:RHBA-2019:4105',
                systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
            }, {
                id: 'patch-advisory:RHBA-2019:0689',
                systems: ['53fbcd90-9c8f-11e8-98d0-529269fb1459']
            }, {
                id: 'patch-advisory:RHBA-2019:2871',
                systems: ['53fbcd90-9c8f-11e8-98d0-529269fb1459']
            }]
        };

        const res = await request
        .post('/v1/playbook')
        .send(data)
        .expect(200);

        expect(res.text).toMatchSnapshot();
    });

    test('aggregates multiple advisories into a single play', async () => {
        const data = {
            issues: [{
                id: 'patch-advisory:RHBA-2019:4105',
                systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
            }, {
                id: 'patch-advisory:RHBA-2019:0689',
                systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
            }, {
                id: 'patch-advisory:RHBA-2019:2871',
                systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
            }]
        };

        const res = await request
        .post('/v1/playbook')
        .send(data)
        .expect(200);

        expect(res.text).toMatchSnapshot();
    });

    test('generates a playbook with patchman advisory remediation with a 6-digit id', async () => {
        const data = {
            issues: [{
                id: 'patch-advisory:RHBA-2024:101234',
                systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
            }]
        };

        const res = await request
        .post('/v1/playbook')
        .send(data)
        .expect(200);

        expect(res.text).toMatchSnapshot();
    });

    test('generates a playbook including EPEL advisory', async () => {
        const data = {
            issues: [{
                id: 'patch-advisory:RHBA-2019:4105',
                systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
            }, {
                id: 'patch-advisory:FEDORA-EPEL-2021-1ad3a13e05',
                systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
            }]
        };

        const res = await request
        .post('/v1/playbook')
        .send(data)
        .expect(200);

        expect(res.text).toMatchSnapshot();
    });

    test('400s on unknown issue', async () => {
        const {id, header} = base.reqId();

        const {body} = await request
        .post('/v1/playbook')
        .set(header)
        .send({
            issues: [{
                id: 'patch-advisory:RHBA-2019:2872',
                systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
            }]
        })
        .expect(400);

        body.errors.should.eql([{
            id,
            status: 400,
            code: 'UNKNOWN_ISSUE',
            title: 'Unknown issue identifier "patch-advisory:RHBA-2019:2872"'
        }]);
    });

    test('400s on unknown resolution type other than fix', async () => {
        const {id, header} = base.reqId();

        const {body} = await request
        .post('/v1/playbook')
        .set(header)
        .send({
            issues: [{
                id: 'patch-advisory:RHBA-2019:4105',
                systems: ['68799a02-8be9-11e8-9eb6-529269fb1459'],
                resolution: 'non-existing-resolution'
            }]
        })
        .expect(400);

        body.errors.should.eql([{
            id,
            status: 400,
            code: 'UNKNOWN_RESOLUTION',
            title: 'Issue "patch-advisory:RHBA-2019:4105"' +
                ' does not have Ansible resolution "non-existing-resolution"'
        }]);
    });
});

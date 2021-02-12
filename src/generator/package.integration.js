'use strict';

const base = require('../test');
const { request } = base;

describe('patchman - package using patch-package', function () {
    test('generates a simple playbook with single patch package update remediation', async () => {
        const data = {
            issues: [{
                id: 'patch-package:rpm-4.14.2-37.el8.x86_64',
                systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
            }]
        };

        const res = await request
        .post('/v1/playbook')
        .send(data)
        .expect(200);

        expect(res.text).toMatchSnapshot();
    });

    test('generates a playbook with multiple packages to upgrade', async () => {
        const data = {
            issues: [{
                id: 'patch-package:rpm-4.14.2-37.el8.x86_64',
                systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
            }, {
                id: 'patch-package:systemd-239-13.el8_0.5.x86_64',
                systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
            }, {
                id: 'patch-package:libstdc++-8.3.1-5.1.el8.x86_64',
                systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
            }, {
                id: 'patch-package:qemu-guest-agent-15:4.2.0-34.module+el8.3.0+8829+e7a0a3ea.1.x86_64',
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
                id: 'patch-package:unknown-1.2.3',
                systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
            }]
        })
        .expect(400);

        body.errors.should.eql([{
            id,
            status: 400,
            code: 'UNKNOWN_ISSUE',
            title: 'Unknown issue identifier "patch-package:unknown-1.2.3"'
        }]);
    });
});

// TODO remove after removing package support in "patch-advisory".
describe('patchman - package using patch-advisory', function () {
    test('generates a simple playbook with single patch package update remediation', async () => {
        const data = {
            issues: [{
                id: 'patch-advisory:rpm-4.14.2-37.el8.x86_64',
                systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
            }]
        };

        const res = await request
        .post('/v1/playbook')
        .send(data)
        .expect(200);

        expect(res.text).toMatchSnapshot();
    });

    test('generates a playbook with multiple packages to upgrade', async () => {
        const data = {
            issues: [{
                id: 'patch-advisory:rpm-4.14.2-37.el8.x86_64',
                systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
            }, {
                id: 'patch-advisory:systemd-239-13.el8_0.5.x86_64',
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
                id: 'patch-advisory:unknown-1.2.3',
                systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
            }]
        })
        .expect(400);

        body.errors.should.eql([{
            id,
            status: 400,
            code: 'UNKNOWN_ISSUE',
            title: 'Unknown issue identifier "patch-advisory:unknown-1.2.3"'
        }]);
    });
});

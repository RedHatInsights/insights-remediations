'use strict';

const base = require('../test');
const { request } = base;

describe('patchman - package', function () {
    test('generates a simple playbook with single patch package update remediation', async () => {
        const data = {
            issues: [{
                id: 'patch-advisory:kernel-4.18.0',
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
                id: 'patch-advisory:kernel-4.18.0',
                systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
            }, {
                id: 'patch-advisory:systemd-239',
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

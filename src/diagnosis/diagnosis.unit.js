'use strict';

const { request, requestLegacy, auth, reqId } = require('../test');
const mockInventory = require('../connectors/inventory/mock');

[request, requestLegacy].forEach((req, index) => {
    // eslint-disable-next-line jest/valid-describe
    describe(`diagnosis${index === 1 ? ' (legacy path)' : ''}`, function () {
        test('returns all details information for the given system', async () => {
            const {body} = await req
            .get('/v1/diagnosis/9a212816-a472-11e8-98d0-529269fb1459')
            .set(auth.cert01)
            .expect(200);

            body.should.have.property('id', '56099741-6294-411d-a5c6-3d0eac23c52f');
            body.should.have.property('insights_id', '9a212816-a472-11e8-98d0-529269fb1459');
            body.should.have.property('details', {
                'crashkernel_reservation_failed|CRASHKERNEL_RESERVATION_FAILED': {
                    rhel_ver: 7,
                    msg: '[    0.000000] crashkernel=auto resulted in zero bytes of reserved memory.',
                    auto_with_low_ram: true,
                    type: 'rule',
                    error_key: 'CRASHKERNEL_RESERVATION_FAILED'
                },
                'rhnsd_pid_world_write|RHNSD_PID_WORLD_WRITABLE': {
                    kernel: false,
                    rel: 7,
                    firmware: false,
                    smt: false,
                    cmd: false,
                    vuln: null,
                    rt: false,
                    cves_fail: ['CVE-2018-3620'],
                    cves_pass: [],
                    type: 'rule',
                    error_key: 'CVE_2018_3620_CPU_KERNEL_NEED_UPDATE'
                }
            });
        });

        test('404s on unknown system', async () => {
            await req
            .get('/v1/diagnosis/' + mockInventory.NON_EXISTENT_SYSTEM)
            .set(auth.cert01)
            .expect(404);
        });

        test('400s on invalid remediation id', async () => {
            const {id, header} = reqId();
            const {body} = await req
            .get('/v1/diagnosis/9a212816-a472-11e8-98d0-529269fb1459?remediation=foo')
            .set(header)
            .set(auth.cert01)
            .expect(400);

            body.errors.should.eql([{
                id,
                status: 400,
                code: 'format.openapi.validation',
                title: 'should match format "uuid" (location: query, path: remediation)'
            }]);
        });
    });

});

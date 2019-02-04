'use strict';

const impl = require('./impl');
const base = require('../../test');
const Connector = require('../Connector');
const data = require('./impl.unit.data');
const { mockRequest } = require('../testUtils');

describe('advisor impl', function () {

    beforeEach(mockRequest);

    test('parses diagnosis reports', async function () {
        const spy = base.getSandbox().stub(Connector.prototype, 'doHttp').resolves(data.diagnosis1);

        const diagnosis = await impl.getDiagnosis('id');

        spy.callCount.should.equal(1);
        diagnosis.should.eql({
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
});

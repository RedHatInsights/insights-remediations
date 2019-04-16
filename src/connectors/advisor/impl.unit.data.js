'use strict';

/* eslint max-len: off */

exports.diagnosis1 = [
    {
        rule: {
            rule_id: 'crashkernel_reservation_failed|CRASHKERNEL_RESERVATION_FAILED'
        },
        details: {
            rhel_ver: 7,
            msg: '[    0.000000] crashkernel=auto resulted in zero bytes of reserved memory.',
            auto_with_low_ram: true,
            type: 'rule',
            error_key: 'CRASHKERNEL_RESERVATION_FAILED'
        }
    },
    {
        rule: {
            rule_id: 'rhnsd_pid_world_write|RHNSD_PID_WORLD_WRITABLE'
        },
        details: {
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
    }
];

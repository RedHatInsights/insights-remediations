'use strict';

/* eslint max-len: off */

exports.diagnosis1 = {
    id: 451,
    system_uuid: '70022cdf-bfd2-49d6-9cf3-99ff1436c48f',
    account: '901578',
    system_type: 105,
    checked_on: '2019-01-18T09:50:18.995332-05:00',
    active_reports: [
        {
            id: 1197,
            rule: {
                id: 53,
                rule_id: 'crashkernel_reservation_failed|CRASHKERNEL_RESERVATION_FAILED',
                description: 'Kdump crashkernel reservation failed due to improper configuration of crashkernel parameter',
                severity: 2,
                active: true,
                category: {
                    name: 'Stability'
                },
                impact: {
                    name: 'Diagnostics Failure',
                    impact: 1
                },
                likelihood: 3,
                node_id: '59432',
                tags: 'kdump incident',
                has_playbook: false,
                reboot_required: false,
                publish_date: '2016-10-31T04:08:33-04:00',
                summary: 'The crashkernel configuration has failed to produce a working kdump environment. Configuration changes must be made to enable vmcore capture.\n',
                generic: 'Kdump is unable to reserve memory for the kdump kernel. The kdump service has not started and a vmcore will not be captured if the host crashes, which will make it difficult for our support technicians to determine why the machine crashed.',
                reason: 'This host is unable to reserve memory for the kdump kernel:\n~~~\n{{=pydata.msg}}\n~~~\n\nThis means the kdump service has not started and a vmcore will not be captured if the host crashes, which will make it difficult for our support technicians to determine why the machine crashed.\n',
                more_info: ''
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
            id: 1198,
            rule: {
                id: 468,
                rule_id: 'rhnsd_pid_world_write|RHNSD_PID_WORLD_WRITABLE',
                description: 'Code injection risk or wrong pid altering when rhnsd daemon file rhnsd.pid is world writable, due to a bug in rhnsd',
                severity: 2,
                active: true,
                category: {
                    name: 'Availability'
                },
                impact: {
                    name: 'Hardening',
                    impact: 1
                },
                likelihood: 2,
                node_id: '3220971',
                tags: 'sbr_sysmgmt sysmgmt rhnsd',
                has_playbook: true,
                reboot_required: false,
                publish_date: '2018-08-15T00:24:00-04:00',
                summary: 'Code injection or wrong pid altering occurs when rhnsd daemon file rhnsd.pid is world writable, due to a bug in rhnsd.\n',
                generic: 'Code injection or wrong pid altering occurs when rhnsd daemon file `rhnsd.pid` is world writable, due to a bug in `rhnsd`.\n',
                reason: 'On this host, `rhnsd` daemon file `/var/run/rhnsd.pid` is world writable, which will cause code injection or wrong pid altering.\n\nPermission of `/var/run/rhnsd.pid`:\n  ~~~\n  {{=pydata.perm}}\n  ~~~\n',
                more_info: ''
            },
            details: '{"kernel": false, "rel": 7, "firmware": false, "smt": false, "cmd": false, "vuln": null, "rt": false, "cves_fail": ["CVE-2018-3620"], "cves_pass": [], "type": "rule", "error_key": "CVE_2018_3620_CPU_KERNEL_NEED_UPDATE"}'
        }
    ]
};

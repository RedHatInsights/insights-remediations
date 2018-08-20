'use strict';

const errors = require('../errors');

/*
 * For now this is a mock implementation
 */
exports.getDiagnosis = errors.async(async function (req, res) {
    const systemId = req.swagger.params.system.value;

    // TODO:
    // 1) obtain system data from inventory
    // 2) verify the principal is allowed to read the current system
    // 3) get report details from advisor, vulnerabilities

    res.json({
        diagnosis: {
            'CVE_2018_1111_dhcp|ERROR_CVE_2018_1111_DHCP_2': {
                dhcp_devs: [
                    'enp0s3'
                ],
                system: systemId
            },
            'CVE_2017_5753_4_cpu_kernel|KERNEL_CVE_2017_5753_4_CPU_ERROR_3': {
                debugfs_available: true,
                dmesg_available: true,
                dmesg_wrapped: false
            }
        }
    });
});

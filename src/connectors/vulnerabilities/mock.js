'use strict';

const DATA = {
    'CVE_2017_6074_kernel|KERNEL_CVE_2017_6074': {
        id: 'CVE_2017_6074_kernel|KERNEL_CVE_2017_6074',
        description: 'Kernel vulnerable to local privilege escalation via DCCP module (CVE-2017-6074)'
    }
};

exports.getRule = async function (id) {
    if (DATA[id]) {
        return DATA[id];
    }

    return null;
};

exports.ping = function () {
    return exports.getRule('CVE_2017_6074_kernel|KERNEL_CVE_2017_6074');
};


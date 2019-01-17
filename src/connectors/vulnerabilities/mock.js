'use strict';

const Connector = require('../Connector');

const DATA = {
    'CVE_2017_6074_kernel|KERNEL_CVE_2017_6074': {
        id: 'CVE_2017_6074_kernel|KERNEL_CVE_2017_6074',
        description: 'Kernel vulnerable to local privilege escalation via DCCP module (CVE-2017-6074)'
    }
};

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    getRule (id) {
        if (DATA[id]) {
            return DATA[id];
        }

        return null;
    }

    ping () {
        return this.getRule('CVE_2017_6074_kernel|KERNEL_CVE_2017_6074');
    }
}();

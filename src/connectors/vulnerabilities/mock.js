'use strict';

const _ = require('lodash');
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
        if (_.has(DATA, id)) {
            // eslint-disable-next-line security/detect-object-injection
            return DATA[id];
        }

        return null;
    }

    getSystems () {
        return [
            '2317adf3-911e-4db3-84fd-27fad9724196',
            '286f602a-157f-4095-8bf2-ad4849ab6c43'
        ];
    }

    ping () {
        return this.getRule('CVE_2017_6074_kernel|KERNEL_CVE_2017_6074');
    }
}();

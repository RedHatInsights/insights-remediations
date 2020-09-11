'use strict';

const _ = require('lodash');
const Connector = require('../Connector');

const DATA = {
    'CVE_2017_6074_kernel|KERNEL_CVE_2017_6074': {
        id: 'CVE_2017_6074_kernel|KERNEL_CVE_2017_6074',
        description: 'Kernel vulnerable to local privilege escalation via DCCP module (CVE-2017-6074)'
    }
};

/* eslint-disable max-len */
const RESOLUTION_DATA = {
    'CVE_2017_6074_kernel|KERNEL_CVE_2017_6074': [{
        version: 'unknown',
        resolution_risk: -1,
        resolution_type: 'fix',
        play: '- name: Correct Bonding Config Items\n  hosts: "{{HOSTS}}"\n  become: true\n  vars:\n    pydata: "{{ insights_report.details[\'CVE_2017_6074_kernel|KERNEL_CVE_2017_6074\'] }}"\n\n  tasks:\n    - when:\n       - pydata.bond_config is defined\n      block:\n        - name: Add quotes around bonding options\n          lineinfile:\n            dest: "/etc/sysconfig/network-scripts/ifcfg-{{ item.key }}"\n            regexp: \'(^\\s*BONDING_OPTS=)(.*)\'\n            backrefs: yes\n            line: \'\\1"\\2"\'\n          with_dict: "{{ pydata.bond_config }}"\n\n        - name: Restart Network Interfaces\n          shell: ifdown {{item.key}}  && ifup {{item.key}}\n          with_dict: "{{ pydata.bond_config }}"\n',
        description: 'Fix Issues caused by [CVE_2017_6074_kernel|KERNEL_CVE_2017_6074]'
    }]
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

    getResolutions (id) {
        if (_.has(RESOLUTION_DATA, id)) {
            // eslint-disable-next-line security/detect-object-injection
            return RESOLUTION_DATA[id];
        }

        return null;
    }

    ping () {
        return this.getRule('CVE_2017_6074_kernel|KERNEL_CVE_2017_6074');
    }
}();

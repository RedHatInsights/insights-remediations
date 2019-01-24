'use strict';

const Connector = require('../Connector');

const DATA = {
    'network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE': {
        id: 'network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE',
        description: 'Bonding will not fail over to the backup link when bonding options are partially read'
    },

    'alias_interface_invalid|ALIAS_INTERFACE_INVALID': {
        id: 'alias_interface_invalid|ALIAS_INTERFACE_INVALID',
        description: 'Interface enabled at boot-time when ONBOOT parameter is disabled in configuration file'
    },

    'bond_config_issue|NO_QUOTES': {
        id: 'bond_config_issue|NO_QUOTES',
        description: 'Unexpected bonding behavior with incorrect syntax in bond configuration files'
    }
};

const DIAGNOSIS = {
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
};

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    async getRule (id) {
        if (DATA[id]) {
            return DATA[id];
        }

        return null;
    }

    async getDiagnosis (system) {
        if (system === 'none') {
            return {};
        }

        return DIAGNOSIS;
    }

    ping () {
        return this.getRule('network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE');
    }
}();

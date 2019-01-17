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

    ping () {
        return this.getRule('network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE');
    }
}();

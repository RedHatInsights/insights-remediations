'use strict';

const DATA = {
    'bond_config_issue|BOND_CONFIG_ISSUE': {
        id: 'bond_config_issue|BOND_CONFIG_ISSUE',
        description: 'Unexpected bonding behavior with incorrect syntax in bond configuration files'
    }
};

exports.getRule = async function (id) {
    if (DATA[id]) {
        return DATA[id];
    }

    return null;
};


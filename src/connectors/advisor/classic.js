'use strict';

const _ = require('lodash');
const config = require('../../config');
const classic = require('../classic');

exports.getRule = _.partial(classic.getRule, config.advisor);

exports.ping = function () {
    return exports.getRule('network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE');
};


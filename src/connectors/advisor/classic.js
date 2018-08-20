'use strict';

const _ = require('lodash');
const config = require('../../config');
const classic = require('../classic');

exports.getRule = _.partial(classic.getRule, config.advisor);

exports.ping = function () {
    return exports.getRule('bond_config_issue|BOND_CONFIG_ISSUE');
};


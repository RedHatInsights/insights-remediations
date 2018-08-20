'use strict';

const _ = require('lodash');
const config = require('../../config');
const classic = require('../classic');

exports.getRule = _.partial(classic.getRule, config.vulnerabilities);

exports.ping = function () {
    return exports.getRule('CVE_2017_6074_kernel|KERNEL_CVE_2017_6074');
};


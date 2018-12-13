'use strict';

const config = require('../../config');

if (config.compliance.impl) {
    module.exports = require(`./${config.compliance.impl}`);
} else {
    module.exports = require('./mock');
}

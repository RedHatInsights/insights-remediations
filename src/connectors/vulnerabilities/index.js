'use strict';

const config = require('../../config');

if (config.vulnerabilities.impl) {
    module.exports = require(`./${config.vulnerabilities.impl}`);
} else if (config.env === 'test' || config.env === 'development') {
    module.exports = require('./mock');
} else {
    module.exports = require('./impl');
}

'use strict';

const config = require('../../config');

if (config.advisor.impl) {
    module.exports = require(`./${config.advisor.impl}`);
} else if (config.env === 'test' || config.env === 'development') {
    module.exports = require('./mock');
} else {
    module.exports = require('./classic');
}

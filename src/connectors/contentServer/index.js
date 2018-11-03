'use strict';

const config = require('../../config');

if (config.contentServer.impl) {
    module.exports = require(`./${config.contentServer.impl}`);
} else if (config.env === 'test' || config.env === 'development') {
    module.exports = require('./mock');
} else {
    module.exports = require('./impl');
}

'use strict';

const config = require('../../config');

if (config.users.impl) {
    module.exports = require(`./${config.users.impl}`);
} else if (config.env === 'test' || config.env === 'development') {
    module.exports = require('./mock');
} else {
    module.exports = require('./impl');
}

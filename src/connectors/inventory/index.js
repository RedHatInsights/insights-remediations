'use strict';

const config = require('../../config');

if (config.inventory.impl) {
    module.exports = require(`./${config.inventory.impl}`);
} else {
    module.exports = require('./mock');
}

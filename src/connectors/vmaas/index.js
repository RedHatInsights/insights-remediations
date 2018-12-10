'use strict';

const config = require('../../config');

if (config.vmaas.impl) {
    module.exports = require(`./${config.vmaas.impl}`);
} else {
    module.exports = require('./vmaas');
}

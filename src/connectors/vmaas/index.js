'use strict';

const config = require('../../config');

if (config.vmaas.impl === 'mock') {
    module.exports = require('./mock');
} else {
    module.exports = require('./vmaas');
}

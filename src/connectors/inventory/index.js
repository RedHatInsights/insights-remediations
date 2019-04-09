'use strict';

const config = require('../../config');

if (config.inventory.impl === 'impl') {
    module.exports = require('./impl');
} else {
    module.exports = require('./mock');
}

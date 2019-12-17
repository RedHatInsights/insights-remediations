'use strict';

const config = require('../../config');

if (config.receptor.impl === 'mock' || config.env === 'test' || config.env === 'development') {
    module.exports = require('./mock');
} else {
    module.exports = require('./impl');
}

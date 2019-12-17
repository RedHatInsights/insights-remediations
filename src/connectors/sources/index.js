'use strict';

const config = require('../../config');

if (config.sources.impl === 'mock' || config.env === 'test' || config.env === 'development') {
    module.exports = require('./mock');
} else {
    module.exports = require('./impl');
}

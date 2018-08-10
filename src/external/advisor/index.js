'use strict';

const config = require('../../config');
module.exports = config.env === 'test' ? require('./mock') : require('./impl');

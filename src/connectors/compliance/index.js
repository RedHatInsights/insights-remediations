'use strict';

const config = require('../../config');

if (config.compliance.impl === 'impl') {
    module.exports = require('./impl');
} else {
    module.exports = require('./mock');
}

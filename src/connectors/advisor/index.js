'use strict';

const config = require('../../config');

if (config.advisor.impl === 'impl') {
    module.exports = require('./impl');
} else {
    module.exports = require('./mock');
}

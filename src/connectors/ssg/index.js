'use strict';

const impl = require('../../config').ssg.impl;

if (impl === 'impl') {
    module.exports = require('./impl');
} else {
    module.exports = require('./mock');
}

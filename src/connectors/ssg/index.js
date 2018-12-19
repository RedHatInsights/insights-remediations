'use strict';

const config = require('../../config');

if (config.ssg.impl) {
    module.exports = require(`./${config.ssg.impl}`);
} else {
    module.exports = require('./impl');
}

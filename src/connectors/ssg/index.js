'use strict';

const impl = require('../../config').cac.impl;

if (impl) {
    module.exports = require(`./${impl}`);
} else {
    module.exports = require('./impl');
}

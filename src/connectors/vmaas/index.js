'use strict';

const { useMock } = require('../common');
const config = require('../../config');

if (useMock(config.vmaas.impl)) {
    module.exports = require('./mock');
} else {
    module.exports = require('./vmaas');
}

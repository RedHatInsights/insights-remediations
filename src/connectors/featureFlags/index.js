'use strict';

const { useMock } = require('../common');
const config = require('../../config');

if (useMock(config.featureFlags.impl)) {
    module.exports = require('./mock');
} else {
    module.exports = require('./impl');
}

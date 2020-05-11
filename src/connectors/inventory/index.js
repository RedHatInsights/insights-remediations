'use strict';

const config = require('../../config');
const { useMock } = require('../common');

if (useMock(config.inventory.impl)) {
    module.exports = require('./mock');
} else if (config.inventory.impl === 'xjoin') {
    module.exports = require('./xjoin');
} else {
    module.exports = require('./impl');
}

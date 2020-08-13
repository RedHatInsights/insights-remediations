'use strict';

const { useMock } = require('../common');
const config = require('../../config');

if (useMock(config.ssg.impl)) {
    module.exports = require('./mock');
} else if (config.ssg.impl === 'compliance') {
    module.exports = require('./compliance');
} else {
    module.exports = require('./impl');
}

'use strict';

const config = require('../config');

exports.useMock = function (impl) {
    if (impl === 'mock') {
        return true;
    }

    if (impl === undefined && ['development', 'test'].includes(config.env)) {
        return true;
    }

    return false;
};

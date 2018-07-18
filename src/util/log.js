'use strict';

const pino = require('pino');
const config = require('../config');

module.exports = pino({
    name: 'remediations',
    level: config.logging.level,
    prettyPrint: config.logging.pretty
});

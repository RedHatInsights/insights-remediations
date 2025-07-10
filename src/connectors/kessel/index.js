'use strict';

const config = require('../../config');
const KesselConnector = require('./impl');

module.exports = new KesselConnector(module, config.kessel); 
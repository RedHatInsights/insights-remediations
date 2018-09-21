'use strict';

const config = require('../../config');
module.exports = require(`./${config.inventory.impl}`);

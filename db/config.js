'use strict';

const {db} = require('../src/config');

module.exports = {
    development: db,
    test: db,
    production: db
};

'use strict';

const errors = require('../errors');
const { getExposedConfig } = require('./index');

exports.get = errors.async(function (req, res) {
    res.json(getExposedConfig()).end();
});

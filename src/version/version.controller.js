'use strict';

const { version, short } = require('../util/version');
const errors = require('../errors');

exports.get = errors.async(function (req, res) {
    res.json({ version, commit: short }).end();
});

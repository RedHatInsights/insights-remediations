'use strict';

const { version, short } = require('../util/version');

exports.get = function (req, res) {
    res.json({ version, commit: short }).end();
};

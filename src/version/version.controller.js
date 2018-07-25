'use strict';

const { version, commit } = require('../util/version');

exports.get = function (req, res) {
    res.json({ version, commit }).end();
};

'use strict';

const errors = require('../errors');

exports.throw500 = errors.async(async function (req) {
    throw new Error(`intentional server error triggered by ${req.user.username}`);
});

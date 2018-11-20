'use strict';

const _ = require('lodash');
const utils = require('./utils');

module.exports = function (req, res, next) {
    if (_.isUndefined(req.headers[utils.IDENTITY_HEADER])) {
        req.headers[utils.IDENTITY_HEADER] = utils.createIdentityHeader();
    }

    next();
};

'use strict';

const _ = require('lodash');

exports.getErrata = function (ids) {
    return Promise.resolve(_.keyBy(ids));
};

'use strict';

const controller = require('./admin.controller');
const isInternal = require('../middleware/isInternal');

module.exports = function (router) {
    router.get('/admin/500', isInternal, controller.throw500);
};

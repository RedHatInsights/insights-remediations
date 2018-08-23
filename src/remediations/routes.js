'use strict';

const controller = require('./remediations.controller');

module.exports = function (router) {
    router.get('/remediations', controller.list);
    router.get('/remediations/:id', controller.get);
    router.post('/remediations', controller.create);
    router.delete('/remediations/:id', controller.remove);
};

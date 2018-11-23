'use strict';

const read = require('./controller.read');
const write = require('./controller.write');

module.exports = function (router) {
    router.get('/remediations', read.list);
    router.get('/remediations/:id', read.get);
    router.post('/remediations', write.create);
    router.delete('/remediations/:id', write.remove);
};

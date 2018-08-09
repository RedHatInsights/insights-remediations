'use strict';

const Play = require('../Play');
const TEMPLATES = require('../templates/static').test;

exports.application = 'test';

exports.createPlay = function ({id, hosts}) {
    if (TEMPLATES[id.issue]) {
        return new Play(id, TEMPLATES[id.issue], hosts);
    }
};

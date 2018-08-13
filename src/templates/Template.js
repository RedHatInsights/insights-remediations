'use strict';

const mustache = require('mustache');
const {notNil} = require('../util/preconditions');

const TAG = '@@';
const HOSTS_PLACEHOLDER = `${TAG}HOSTS${TAG}`;
mustache.tags = [TAG, TAG];

module.exports = class Template {

    constructor (data) {
        this.data = notNil(data);
    }

    render (parameters) {
        return mustache.render(this.data, {
            ...parameters,
            ...this.parameters
        });
    }
};

module.exports.HOSTS_PLACEHOLDER = HOSTS_PLACEHOLDER;

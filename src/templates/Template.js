'use strict';

const mustache = require('mustache');
const {notNil} = require('../util/preconditions');
const errors = require('../errors');

const TAG = '@@';
const HOSTS_PLACEHOLDER = `${TAG}HOSTS${TAG}`;
mustache.tags = [TAG, TAG];

/*
 * Will cause rendering to fail if some of the variables required by the template are not provided.
 */
class StrictContext extends mustache.Context {

    constructor(...args) {
        super(...args);
    }

    lookup (name) {
        const value = super.lookup(name);

        if (value === undefined) {
            throw errors.internal.missingVariable(name);
        }

        return value;
    }
}

module.exports = class Template {

    constructor (data) {
        this.data = notNil(data);
    }

    render (parameters) {
        return mustache.render(this.data, new StrictContext({
            ...parameters,
            ...this.parameters
        }));
    }
};

module.exports.HOSTS_PLACEHOLDER = HOSTS_PLACEHOLDER;

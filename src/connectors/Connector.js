'use strict';

const assert = require('assert');

module.exports = class Connector {

    constructor (module) {
        assert(module, 'module not set');
        const parts = module.filename.replace('.js', '').split('/');
        this.impl = parts[parts.length - 1];
        this.name = parts[parts.length - 2];
    }

    getName () {
        return this.name;
    }

    getImpl () {
        return this.impl;
    }
};

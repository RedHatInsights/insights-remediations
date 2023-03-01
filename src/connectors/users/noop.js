'use strict';

const Connector = require('../Connector');

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    async getUser (username) {
        return {[username]: { username, first_name: '', last_name: '' }};
    }

    async ping () {}
}();

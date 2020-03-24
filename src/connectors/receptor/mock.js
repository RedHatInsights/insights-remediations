'use strict';

const Connector = require('../Connector');
const uuid = require('uuid');

const CONNECTION_STATUS = {status: 'connected'};

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    async getConnectionStatus (account, id) {
        if (id === '098764') {
            return {status: 'disconnected'};
        }

        return CONNECTION_STATUS;
    }

    async postInitialRequest () {
        return {id: uuid.v4()};
    }

    async ping () {
        await this.getConnectionStatus ('540155', 'node-a');
    }
}();

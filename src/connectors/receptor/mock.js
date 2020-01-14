'use strict';

const Connector = require('../Connector');

const CONNECTION_STATUS = {status: 'connected'};
const WORK_RESPONSE = {id: '355986a3-5f37-40f7-8f36-c3ac928ce190'};

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
        return WORK_RESPONSE;
    }

    async ping () {
        await this.getConnectionStatus ('540155', 'node-a');
    }
}();

'use strict';

const Connector = require('../Connector');

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    postPlaybookRunRequests () {
        return [{
            code: 201,
            id: '22655919-4aea-4f57-935a-e70f246af842'
        }];
    }

    fetchPlaybookRuns () {
        return null;
    }

    fetchPlaybookRunHosts () {
        return null;
    }

    ping () {}
}();

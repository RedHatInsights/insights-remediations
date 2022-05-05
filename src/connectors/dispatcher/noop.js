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

    postV2PlaybookRunRequests () {
        return [{
            code: 201,
            id: '88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc'
        }];
    }

    fetchPlaybookRuns () {
        return null;
    }

    fetchPlaybookRunHosts () {
        return null;
    }

    postPlaybookCancelRequest () {
        return [
            {
                code: 202,
                run_id: '88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc'
            }
        ]
    }

    getPlaybookRunRecipientStatus () {
        return null;
    }

    ping () {}
}();

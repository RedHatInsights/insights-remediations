'use strict';

const Connector = require('../Connector');

const MOCKDISPATCHRESPONSE = [
    {
        code: 200,
        id: '7ef23cc6-729f-4f65-8ce7-6f8185c051e9'
    }, {
        code: 200,
        id: '5907b393-1448-4867-988b-5eed8fc02846'
    }
];

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    postPlaybookRunRequests () {
        return MOCKDISPATCHRESPONSE;
    }

    ping () {}
}();

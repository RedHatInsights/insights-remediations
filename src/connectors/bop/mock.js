'use strict';

const Connector = require("../Connector");

const ORG_IDS = {
    "540155": "1979710",
    "2828282": "29393933",
    "3098430": "38393949"
};

const ORG_IDS_2 = {
    "demo": "1",
    "test": "2",
    "fifi": "3",
    "testStatus": "4",
    "testWrite": "5",
    "testReadSingle": "6"
};

const EBS_ACCOUNTS = {
    "29393933": "2828282",
    "1979710": "540155",
    "38393949": "3098430"
};

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    async getTenantOrgIds() {
        return ORG_IDS_2;
    }

    async getEBSAccounts(req) {
        return EBS_ACCOUNTS;
    }

    async ping () {
        await this.getTenantOrgIds();
    }
}();

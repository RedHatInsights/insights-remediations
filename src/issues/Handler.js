'use strict';

module.exports = class Handler {

    async getIssueDetails () {
        throw new Error('not implemented');
    }

    getResolutionResolver () {
        throw new Error('not implemented');
    }

    getPlayFactory () {
        throw new Error('not implemented');
    }
};

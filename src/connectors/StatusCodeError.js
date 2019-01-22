'use strict';

module.exports = class StatusCodeError extends Error {
    constructor (statusCode, options) {
        super(`Unexpected status code ${statusCode}`);
        this.statusCode = statusCode;
        this.options = options;
    }
};

'use strict';

module.exports = class StatusCodeError extends Error {
    constructor (statusCode, options, details) {
        super(`Unexpected status code ${statusCode}`);
        this.statusCode = statusCode;
        this.options = options;
        this.details = details;
    }
};

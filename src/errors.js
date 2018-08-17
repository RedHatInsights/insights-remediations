'use strict';

const _ = require('lodash');
const log = require('./util/log');

class HttpError {
    constructor (status) {
        this.status = status;
    }

    writeResponse (res) {
        res.status(this.status).end();
    }
}

class InternalError extends Error {
    constructor (errorCode, message, details = {}) {
        super(message);
        this.errorCode = errorCode;
        _.assign(this, details);
    }
}

exports.InternalError = InternalError;

exports.BadRequest = class BadRequest extends HttpError {
    constructor (code, message, details) {
        super(400);
        this.data = {
            error: {
                code,
                message
            }
        };

        if (details) {
            this.data.details = details;
        }
    }

    writeResponse (res) {
        res.status(this.status).json(this.data).end();
    }
};

exports.handler = (err, req, res, next) => {

    // swagger request validation handler
    if (err.code === 'SCHEMA_VALIDATION_FAILED' && !err.originalResponse) {
        const {code, message} = err.results.errors[0];
        log.debug('rejecting request due to SCHEMA_VALIDATION_FAILED');

        return res
        .status(400)
        .json({
            error: {
                code,
                message
            }
        })
        .end();
    }

    if (err instanceof HttpError) {
        log.debug(err, 'rejecting request due to HttpError');
        return err.writeResponse(res);
    }

    log.error({
        error: {
            message: err.message,
            stack: err.stack,
            ...err
        }
    }, 'caught internal error');

    next(err);
};

exports.async = fn => (req, res, next) => {
    const result = fn(req, res, next);

    if (!_.isUndefined(result) && _.isFunction(result.catch)) {
        result.catch(e => next(e));
    }

    return result;
};

exports.unknownIssue = id =>
    new exports.BadRequest('UNKNOWN_ISSUE', `Unknown issue identifier "${id.full}"`);

exports.unsupportedIssue = id =>
    new exports.BadRequest('UNSUPPORTED_ISSUE', `Issue "${id.full}" does not have Ansible support`);

exports.unknownResolution = (id, resolution) =>
    new exports.BadRequest('UNKNOWN_RESOLUTION', `Issue "${id.full}" does not have Ansible resolution "${resolution}"`);

exports.internal = {
    missingVariable (variable) {
        return new InternalError('MISSING_VARIABLE', `Variable "${variable}" not provided for template`);
    },

    playbookValidationFailed (e, playbook) {
        return new InternalError('PLAYBOOK_VALIDATION_FAILED', 'Playbook output validation failed', {cause: e, playbook});
    },

    dependencyFailureHttp (e) {
        return new InternalError('DEPENDENCY_FAILURE_HTTP', 'An HTTP dependency returned unexpected response', {
            cause: e
        });
    },

    preconditionFailed (msg) {
        return new InternalError('PRECONDITION_FAILED', msg);
    }
};

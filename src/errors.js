'use strict';

const _ = require('lodash');
const log = require('./util/log');
const cls = require('./util/cls');
const config = require('./config');

class HttpError extends Error {
    constructor (status, code, title, details) {
        super(title);
        const req = cls.getReq();
        this.error = {
            id: req ? req.id : undefined,
            status,
            code,
            title
        };

        if (details) {
            this.error.details = details;
        }
    }

    getError () {
        return this.error;
    }

    writeResponse (res) {
        res.status(this.error.status).json({
            errors: [this.getError()]
        }).end();
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
    constructor (code, title, details) {
        super(400, code, title, details);
    }
};

exports.Unauthorized = class Unauthorized extends HttpError {
    constructor () {
        super(401, 'UNAUTHORIZED', 'Authorization headers missing');
    }
};

exports.Forbidden = class Forbidden extends HttpError {
    constructor () {
        super(403, 'FORBIDDEN', 'Access forbidden');
    }
};

exports.DependencyError = class DependencyError extends HttpError {
    constructor (e, connector) {
        super(503, 'DEPENDENCY_UNAVAILABLE', 'Service dependency unavailable', {
            name: connector.getName(),
            impl: connector.getImpl()
        });
        this.cause = e;
    }
};

function mapValidationError ({id}, {code, message: title}) {
    return { id, status: 400, code, title };
}

exports.handler = (error, req, res, next) => {

    // swagger request validation handler
    if (error.failedValidation && !error.originalResponse) {
        if (error.code === 'SCHEMA_VALIDATION_FAILED') {
            const errors = error.results.errors;
            log.debug('rejecting request due to SCHEMA_VALIDATION_FAILED');

            const status = 400;
            return res
            .status(status)
            .json({
                errors: errors.map(error => mapValidationError(req, error))
            })
            .end();
        }

        const status = 400;
        return res
        .status(status)
        .json({
            errors: [mapValidationError(req, error)]
        });
    }

    if (error instanceof exports.DependencyError) {
        log.error({ error }, 'rejecting request due to DependencyError');
        return error.writeResponse(res);
    } else if (error instanceof HttpError) {
        log.debug({ error }, 'rejecting request due to HttpError');
        return error.writeResponse(res);
    }

    log.error({
        error: {
            message: error.message,
            stack: error.stack,
            ..._.omit(error, [
                ['originalResponse'] // avoid writting down the entire response buffer
            ])
        }
    }, 'caught internal error');

    if (config.env !== 'production') {
        return next(error); // write out stack in non-prod envs
    }

    res.status(500).json({
        errors: [{
            id: req.id,
            status: 500,
            code: 'INTERNAL_ERROR',
            title: 'Internal Server Error'
        }]
    });
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

exports.unknownSystem = id =>
    new exports.BadRequest('UNKNOWN_SYSTEM', `Unknown system identifier "${id}"`);

exports.unsupportedIssue = id =>
    new exports.BadRequest('UNSUPPORTED_ISSUE', `Issue "${id.full}" does not have Ansible support`);

exports.unknownResolution = (id, resolution) =>
    new exports.BadRequest('UNKNOWN_RESOLUTION', `Issue "${id.full}" does not have Ansible resolution "${resolution}"`);

exports.invalidIssueId = (id) => new exports.BadRequest('INVALID_ISSUE_IDENTIFIER', `"${id}" is not a valid issue identifier.`);

exports.internal = {
    invalidTemplate (msg) {
        return new InternalError('INVALID_TEMPLATE', msg);
    },

    invalidResolution (msg, template) {
        return new InternalError('INVALID_RESOLUTION', msg, {template});
    },

    playbookValidationFailed (e, playbook) {
        return new InternalError('PLAYBOOK_VALIDATION_FAILED', 'Playbook output validation failed', {cause: e, playbook});
    },

    dependencyError (e, connector) {
        return new exports.DependencyError(e, connector);
    },

    preconditionFailed (msg) {
        return new InternalError('PRECONDITION_FAILED', msg);
    }
};

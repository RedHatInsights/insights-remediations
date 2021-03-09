'use strict';

const _ = require('lodash');
const log = require('./util/log');
const cls = require('./util/cls');
const RequestSpecValidationError = require('./middleware/openapi/RequestSpecValidationError');

class HttpError extends Error {
    constructor (status, code, title, details) {
        super(title);
        const req = cls.getReq();
        this.name = this.constructor.name;
        this.error = {
            id: req ? req.id : 'unknown',
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
    constructor (message) {
        super(403, 'FORBIDDEN', 'Access forbidden', {message});
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

function errorResponse ({id}, res, status, code, title) {
    res.status(status).json({
        errors: [{id, status, code, title}]
    });
}

exports.handler = (error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    // openapi request validation handler
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

    if (error.type === 'entity.too.large') {
        return errorResponse(req, res, 413, error.type, 'Entity too large');
    }

    if (error instanceof exports.DependencyError) {
        log.error(error, 'rejecting request due to DependencyError');
        return error.writeResponse(res);
    } else if (error instanceof HttpError) {
        log.debug(error, 'rejecting request due to HttpError');
        return error.writeResponse(res);
    }

    if (error instanceof RequestSpecValidationError) {
        log.debug(error.errors, 'rejecting request due to RequestSpecValidationError');
        return error.writeResponse(req, res);
    }

    log.error(error, 'caught internal error');
    errorResponse(req, res, 500, 'INTERNAL_ERROR', 'Internal Server Error');
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

exports.invalidOffset = (offset, max) =>
    new exports.BadRequest('INVALID_OFFSET', `Requested starting offset ${offset} out of range: [0, ${max}]`);

exports.noExecutors = remediation =>
    new exports.BadRequest('NO_EXECUTORS', `No executors available for Playbook "${remediation.name}" (${remediation.id})`);

exports.unknownExclude = excluded =>
    new exports.BadRequest('UNKNOWN_EXCLUDE', `Excluded Executor [${excluded}] not found in list of identified executors`);

exports.unauthorizedGeneration = cn =>
    new exports.Forbidden(`Host certificate ${cn} is unauthorized to access this playbook`);

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

    playbookRenderingFailed (e, template) {
        return new InternalError('PLAYBOOK_RENDERING_FAILED', `Playbook rendering failed for template ${template}`, {cause: e});
    },

    dependencyError (e, connector) {
        return new exports.DependencyError(e, connector);
    },

    preconditionFailed (msg) {
        return new InternalError('PRECONDITION_FAILED', msg);
    }
};

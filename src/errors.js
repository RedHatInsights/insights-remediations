'use strict';

const _ = require('lodash');
const log = require('./util/log');
const RequestSpecValidationError = require('./middleware/openapi/RequestSpecValidationError');

class HttpError extends Error {
    constructor (status, code, title, details, req) {
        super(title);
        this.name = this.constructor.name;
        const requestId = req && (req.id || req.headers?.['x-rh-insights-request-id'])
            ? (req.id || req.headers['x-rh-insights-request-id'])
            : 'unknown';
        this.error = {
            id: requestId,
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

class CompositeError extends Error {
    constructor (errors, ...params) {
        super(...params);

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, CompositeError);
        }

        this.errors = errors;
    }
}

exports.CompositeError = CompositeError;

exports.BadRequest = class BadRequest extends HttpError {
    constructor (code, title, details, req) {
        super(400, code, title, details, req);
    }
};

exports.Unauthorized = class Unauthorized extends HttpError {
    constructor (req) {
        super(401, 'UNAUTHORIZED', 'Authorization headers missing', undefined, req);
    }
};

exports.Forbidden = class Forbidden extends HttpError {
    constructor (message, req) {
        super(403, 'FORBIDDEN', 'Access forbidden', {message}, req);
    }
};

exports.Unprocessable = class BadRequest extends HttpError {
    constructor (code, title, details, req) {
        super(422, code, title, details, req);
    }
};

exports.DependencyError = class DependencyError extends HttpError {
    constructor (e, connector, req) {
        super(
            503,
            'DEPENDENCY_UNAVAILABLE',
            // eslint-disable-next-line max-len
            'Internal service dependency is temporarily unavailable.  If the issue persists please contact Red Hat support: https://access.redhat.com/support/cases/', {
                name: connector.getName(),
                impl: connector.getImpl()
            },
            req
        );
        this.cause = e;
    }
};

function mapValidationError (req, openapiErr) {
    const { code, message: title } = openapiErr;
    const requestId = (req && (req.id || req.headers?.['x-rh-insights-request-id'])) || 'unknown';
    return { id: requestId, status: 400, code, title };
}

function errorResponse (req, res, status, code, title) {
    const requestId = (req && (req.id || req.headers?.['x-rh-insights-request-id'])) || 'unknown';
    res.status(status).json({
        errors: [{id: requestId, status, code, title}]
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
        log.warn({
            requestId: req.id,
            error: error.getError?.() || error
        }, 'rejecting request due to HttpError');
        return error.writeResponse(res);
    }

    if (error instanceof RequestSpecValidationError) {
        log.warn({
            requestId: req.id,
            errors: error.errors
        }, 'rejecting request due to RequestSpecValidationError');
        return error.writeResponse(req, res);
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
        const errors = error.errors;
        return errorResponse(req, res, 400, error.name, `Remediation name must be unique within organization. ${error.errors[0].value} already exists within org ${error.errors[1].value}.`);
    }

    if (error.name === 'SequelizeValidationError') {
        const errors = error.errors;
        return errorResponse(req, res, 400, error.name, `Remediation name cannot be null.`);
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

exports.unknownIssue = (id, req) =>
    new exports.BadRequest('UNKNOWN_ISSUE', `Unknown issue identifier "${id.full}"`, undefined, req);

exports.unknownSystem = (id, req) =>
    new exports.BadRequest('UNKNOWN_SYSTEM', `Unknown system identifier "${id}"`, undefined, req);

exports.unsupportedIssue = (id, req) =>
    new exports.BadRequest('UNSUPPORTED_ISSUE', `Issue "${id.full}" does not have Ansible support`, undefined, req);

exports.unknownResolution = (id, resolution, req) =>
    new exports.BadRequest('UNKNOWN_RESOLUTION', `Issue "${id.full}" does not have Ansible resolution "${resolution}"`, undefined, req);

exports.invalidIssueId = (id, req) => new exports.BadRequest('INVALID_ISSUE_IDENTIFIER', `"${id}" is not a valid issue identifier.`, undefined, req);

exports.invalidOffset = (offset, max, req) =>
    new exports.BadRequest('INVALID_OFFSET', `Requested starting offset ${offset} out of range: [0, ${max}]`, undefined, req);

exports.noExecutors = remediation =>
    new exports.Unprocessable('NO_EXECUTORS', `No executors available for Playbook "${remediation.name}" (${remediation.id})`);

exports.noSystems = remediation =>
    new exports.Unprocessable('NO_SYSTEMS', `Remediation ${remediation.id} contains no systems`);

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

    dependencyError (e, connector, req) {
        return new exports.DependencyError(e, connector, req);
    },

    preconditionFailed (msg) {
        return new InternalError('PRECONDITION_FAILED', msg);
    },

    systemDetailsMissing (e, msg) {
        return new InternalError('MISSING_SYSTEM_DETAILS', msg, {cause: e});
    },

    systemProfileMissing (e, msg) {
        return new InternalError('MISSING_SYSTEM_PROFILE', msg, {cause: e});
    }
};

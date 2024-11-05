'use strict';

const _ = require('lodash');
const log = require('./util/log');
const cls = require('./util/cls');
const RequestSpecValidationError = require('./middleware/openapi/RequestSpecValidationError');

class HttpError extends Error {
    constructor (req, status, code, title, details) {
        super(title);
        // const req = cls.getReq();
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
    constructor (req, code, title, details) {
        super(req, 400, code, title, details);
    }
};

exports.Unauthorized = class Unauthorized extends HttpError {
    constructor (req) {
        super(req, 401, 'UNAUTHORIZED', 'Authorization headers missing');
    }
};

exports.Forbidden = class Forbidden extends HttpError {
    constructor (req, message) {
        super(req, 403, 'FORBIDDEN', 'Access forbidden', {message});
    }
};

exports.Unprocessable = class BadRequest extends HttpError {
    constructor (req, code, title, details) {
        super(req, 422, code, title, details);
    }
};

exports.DependencyError = class DependencyError extends HttpError {
    constructor (req, e, connector) {
        super(
            req,
            503,
            'DEPENDENCY_UNAVAILABLE',
            // eslint-disable-next-line max-len
            'Internal service dependency is temporarily unavailable.  If the issue persists please contact Red Hat support: https://access.redhat.com/support/cases/', {
                name: connector.getName(),
                impl: connector.getImpl()
            }
        );
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
        log.error(req, error, 'rejecting request due to DependencyError');
        return error.writeResponse(res);
    } else if (error instanceof HttpError) {
        log.debug(req, error, 'rejecting request due to HttpError');
        return error.writeResponse(res);
    }

    if (error instanceof RequestSpecValidationError) {
        log.debug(error.errors, 'rejecting request due to RequestSpecValidationError');
        return error.writeResponse(res);
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

exports.unknownIssue = (req, id) =>
    new exports.BadRequest(req, 'UNKNOWN_ISSUE', `Unknown issue identifier "${id.full}"`);

exports.unknownSystem = (req, id) =>
    new exports.BadRequest(req, 'UNKNOWN_SYSTEM', `Unknown system identifier "${id}"`);

exports.unsupportedIssue = (req, id) =>
    new exports.BadRequest(req, 'UNSUPPORTED_ISSUE', `Issue "${id.full}" does not have Ansible support`);

exports.unknownResolution = (req, id, resolution) =>
    new exports.BadRequest(req, 'UNKNOWN_RESOLUTION', `Issue "${id.full}" does not have Ansible resolution "${resolution}"`);

exports.invalidIssueId = (req, id) =>
    new exports.BadRequest(req, 'INVALID_ISSUE_IDENTIFIER', `"${id}" is not a valid issue identifier.`);

exports.invalidOffset = (req, offset, max) =>
    new exports.BadRequest(req, 'INVALID_OFFSET', `Requested starting offset ${offset} out of range: [0, ${max}]`);

exports.noExecutors = (req, remediation) =>
    new exports.Unprocessable(req, 'NO_EXECUTORS', `No executors available for Playbook "${remediation.name}" (${remediation.id})`);

exports.noSystems = (req, remediation) =>
    new exports.Unprocessable(req, 'NO_SYSTEMS', `Remediation ${remediation.id} contains no systems`);

exports.unknownExclude = (req, excluded) =>
    new exports.BadRequest(req, 'UNKNOWN_EXCLUDE', `Excluded Executor [${excluded}] not found in list of identified executors`);

exports.unauthorizedGeneration = (req, cn) =>
    new exports.Forbidden(req, `Host certificate ${cn} is unauthorized to access this playbook`);

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

    dependencyError (req, e, connector) {
        return new exports.DependencyError(req, e, connector);
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

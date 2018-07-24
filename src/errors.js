'use strict';

const _ = require('lodash');

class HttpError {
    constructor (status) {
        this.status = status;
    }

    writeResponse (res) {
        res.status(this.status).end();
    }
}

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
        return err.writeResponse(res);
    }

    next(err);
};

exports.async = fn => (req, res, next) => {
    const result = fn(req, res, next);

    if (!_.isUndefined(result) && _.isFunction(result.catch)) {
        result.catch(e => next(e));
    }

    return result;
};

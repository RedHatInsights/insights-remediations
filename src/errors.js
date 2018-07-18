'use strict';

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

    next(err);
};

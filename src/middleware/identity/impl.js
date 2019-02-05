'use strict';

const IDENTITY_HEADER = 'x-rh-identity';
const errors = require('../../errors');
const log = require('../../util/log');

module.exports = function (req, res, next) {
    const raw = req.headers[IDENTITY_HEADER];

    if (raw === undefined) {
        log.info({headers: req.headers}, 'rejecting request due to missing identity header');
        return next(new errors.Unauthorized());
    }

    try {
        const value = Buffer.from(raw, 'base64').toString('ascii');
        req.identity = JSON.parse(value).identity;
        log.trace({identity: req.identity}, 'parsed identity header');

        if (!req.identity.account_number) {
            return next(new errors.Unauthorized());
        }

        if (req.identity.type === 'User') {
            req.user = {
                account_number: req.identity.account_number,
                username: req.identity.user.username
            };
        }

        res.log = res.log.child({req});

        next();
    } catch (e) {
        log.debug({header: raw, error: e.message}, 'Error decoding identity header');
        next(new errors.BadRequest('IDENTITY_HEADER', 'Invalid identity header'));
    }
};

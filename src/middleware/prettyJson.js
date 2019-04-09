'use strict';

const PARAM = 'pretty';
const SPACES = 4;

module.exports = function (req, res, next) {
    // eslint-disable-next-line security/detect-object-injection
    if (typeof req.query[PARAM] !== 'undefined' ||
        (typeof req.headers['user-agent'] === 'string' && req.headers['user-agent'].startsWith('Mozilla'))) {

        res.json = function (body) {
            if (!res.get('Content-Type')) {
                res.set('Content-Type', 'application/json');
            }

            return res.send(JSON.stringify(body, null, SPACES));
        };
    }

    next();
};

'use strict';

/* eslint no-process-env: off */

module.exports = {
    env: process.env.NODE_ENV || 'dev',
    port: (process.env.NODE_ENV === 'test') ? 9003 : 9002,
    logging: {
        level: process.env.LOG_LEVEL || ((process.env.NODE_ENV === 'test') ? 'error' : 'debug'),
        pretty: (process.env.NODE_ENV !== 'prod')
    }
};

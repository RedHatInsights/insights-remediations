'use strict';

/* eslint no-process-env: off */

module.exports = {
    env: process.env.NODE_ENV || 'development',
    port: (process.env.NODE_ENV === 'test') ? 9003 : 9002,
    commit: process.env.OPENSHIFT_BUILD_COMMIT,

    // general timeout for HTTP invocations of external services
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 10000,

    logging: {
        level: process.env.LOG_LEVEL || ((process.env.NODE_ENV === 'test') ? 'error' : 'debug'),
        pretty: (process.env.NODE_ENV !== 'production')
    },

    vmaas: {
        host: process.env.VMAAS_HOST || 'http://webapp-vmaas-stable.1b13.insights.openshiftapps.com'
    }
};

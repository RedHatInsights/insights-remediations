'use strict';

const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const env = process.env;

/* eslint no-process-env: off */
function parseIntEnv (name, defaultValue) {
    if (typeof name !== 'string') {
        throw new Error(`invalid key ${name}`);
    }

    if (env[name] === undefined) {
        return defaultValue;
    }

    const parsed = parseInt(env[name]);

    if (isNaN(parsed)) {
        throw new Error(`invalid value ${name}=${env[name]}`);
    }

    return parsed;
}

const config = {
    env: env.NODE_ENV || 'development',
    port: (env.NODE_ENV === 'test') ? 9003 : 9002,
    commit: env.OPENSHIFT_BUILD_COMMIT,

    // general timeout for HTTP invocations of external services
    requestTimeout: parseInt(env.REQUEST_TIMEOUT) || 10000,

    logging: {
        level: env.LOG_LEVEL || ((env.NODE_ENV === 'test') ? 'error' : 'debug'),
        pretty: (env.NODE_ENV !== 'production')
    },

    advisor: {
        host: env.ADVISOR_HOST || 'https://access.qa.itop.redhat.com',
        auth: env.ADVISOR_AUTH || '',
        insecure: (env.ADVISOR_INSECURE === 'true') ? true : false
    },

    contentServer: {
        host: env.CONTENT_SERVER_HOST || 'http://localhost:8080',
        auth: env.CONTENT_SERVER_AUTH || null,
        insecure: (env.CONTENT_SERVER_INSECURE === 'false') ? false : true
    },

    vmaas: {
        host: env.VMAAS_HOST || 'https://webapp-vmaas-stable.1b13.insights.openshiftapps.com'
    },

    vulnerabilities: {
        host: env.VULNERABILITIES_HOST || 'https://access.qa.itop.redhat.com',
        auth: env.VULNERABILITIES_AUTH || '',
        insecure: (env.VULNERABILITIES_INSECURE === 'true') ? true : false
    },

    ssg: {
        repository: env.SSG_REPO ||
            'https://raw.githubusercontent.com/OpenSCAP/scap-security-guide/255a015c92b869d579cb1af98ff1e83f1babbd55/' +
                'shared/fixes/ansible'
    },

    redis: {
        enabled: env.REDIS_ENABLED === 'true' ? true : false,
        host: env.REDIS_HOST || 'localhost',
        port: parseIntEnv('REDIS_PORT', 6379),
        password: env.REDIS_PASSWORD || undefined
    },

    cache: {
        ttl: parseIntEnv('CACHE_TTL', 24 * 60 * 60), // 24 hours
        revalidationInterval: parseIntEnv('CACHE_REVALIDATION_INVERVAL', 10 * 60) // 10 mins
    },

    db: {
        username: env.DB_USERNAME || 'postgres',
        password: env.DB_PASSWORD || 'remediations',
        database: env.DB_DATABASE || 'remediations',
        host: env.DB_HOST || '127.0.0.1',
        dialect: 'postgres',
        logging: true,
        operatorsAliases: false,
        pool: {
            min: 5,
            max: 50
        },
        define: {
            charset: 'utf8',
            timestamps: false,
            underscored: true
        }
    }
};

if (fs.existsSync(path.join(__dirname, `${config.env}.js`))) {
    _.merge(config, require(`./${config.env}`));
}

module.exports = config;

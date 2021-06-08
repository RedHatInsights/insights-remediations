'use strict';

const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const env = process.env;

const ClowderEnabled = process.env.CLOWDER_ENABLED ? true : false;

/* eslint no-process-env: off */
function parseIntEnv (name, defaultValue) {
    if (typeof name !== 'string') {
        throw new Error(`invalid key ${name}`);
    }

    const value = env[name]; // eslint-disable-line security/detect-object-injection
    if (value === undefined) {
        return defaultValue;
    }

    const parsed = parseInt(value);

    if (isNaN(parsed)) {
        throw new Error(`invalid value ${name}=${value}`);
    }

    return parsed;
}

const config = Config();

function getHostForApp(dependencyEndpoints, appName, deploymentName){
    if (appName in dependencyEndpoints && deploymentName in dependencyEndpoints[appName]) {
        return 'http://' + dependencyEndpoints[appName][deploymentName]['hostname'] + ':' + dependencyEndpoints[appName][deploymentName]['port'] + ''
    } else {
        return ''
    }
}

function Config() {
    if (ClowderEnabled) {
        const loadedConfig = require('app-common-js').LoadedConfig;
        const kafkaTopics = require('app-common-js').KafkaTopics;
        const objectBuckets = require('app-common-js').ObjectBuckets;
        const dependencyEndpoints = require('app-common-js').DependencyEndpoints;

        var config = {

            /*
             * Server configuration
             */
            env: env.NODE_ENV || 'development',
            namespace: env.NAMESPACE || 'unknown',
            port: (env.NODE_ENV === 'test') ? 9003 : 9002,
            commit: env.OPENSHIFT_BUILD_COMMIT,
            demo: (env.DEMO_MODE === 'true') ? true : false,
            platformHostname: env.PLATFORM_HOSTNAME_URL || 'hostname',
            isMarketplace: (env.MARKETPLACE_CHECK === 'true') ? true : false,
        
            bodyParserLimit: env.BODY_PARSER_LIMIT || '1mb',
        
            // by default enabled in non-prod
            validateResponseStrict: env.VALIDATE_RESPONSE_STRICT === undefined ?
                env.NODE_ENV !== 'production' :
                env.VALIDATE_RESPONSE_STRICT === 'true' ? true : false,
        
            path: {
                prefix: env.PATH_PREFIX || '/api',
                app: env.APP_NAME || 'remediations'
            },
        
            logging: {
                level: env.LOG_LEVEL || ((env.NODE_ENV === 'test') ? 'error' : 'debug'),
                pretty: (env.NODE_ENV !== 'production'),
                cloudwatch: {
                    enabled: env.LOG_CW_ENABLED === 'true',
                    level: env.LOG_CW_LEVEL || env.LOG_LEVEL || 'debug',
                    options: {
                        group: env.LOG_CW_GROUP || env.NAMESPACE || 'remediations-local',
                        prefix: env.LOG_CW_PREFIX || 'remediations-',
                        interval: parseIntEnv('LOG_CW_INTERVAL', 1000), // 1000 ms
                        aws_access_key_id: loadedConfig.logging.accessKeyId,
                        aws_secret_access_key: loadedConfig.logging.secretAccessKey,
                        aws_region: env.LOG_CW_REGION || loadedConfig.logging.region
                    }
                }
            },
        
            metrics: {
                prefix: env.METRICS_PREFIX || 'remediations_',
                enabled: env.METRICS_ENABLED === 'false' ? false : true,
                summaryMaxAge: parseIntEnv('METRICS_SUMMARY_MAX_AGE', 10 * 60) // 10 mins
            },
        
            /*
             * Connector configuration
             */
        
            // general timeout for HTTP invocations of external services
            requestTimeout: parseInt(env.REQUEST_TIMEOUT) || 10000,
        
            cache: {
                ttl: parseIntEnv('CACHE_TTL', 24 * 60 * 60), // 24 hours
                revalidationInterval: parseIntEnv('CACHE_REVALIDATION_INVERVAL', 10 * 60) // 10 mins
            },
        
            advisor: {
                impl: env.ADVISOR_IMPL,
                host: env.ADVISOR_HOST || getHostForApp(dependencyEndpoints, 'advisor', 'service') || 'http://insights-advisor-api.advisor-ci.svc.cluster.local:8000',
                auth: env.ADVISOR_AUTH || '',
                insecure: (env.ADVISOR_INSECURE === 'true') ? true : false,
                revalidationInterval: parseIntEnv('ADVISOR_REVALIDATION_INVERVAL', 60 * 60) // 1 hour
            },
        
            compliance: {
                impl: env.COMPLIANCE_IMPL,
                host: env.COMPLIANCE_HOST || getHostForApp(dependencyEndpoints, 'compliance', 'service') || 'http://compliance-backend.compliance-ci.svc.cluster.local:3000',
                insecure: (env.COMPLIANCE_INSECURE === 'true') ? true : false,
                revalidationInterval: parseIntEnv('COMPLIANCE_REVALIDATION_INVERVAL', 60 * 60) // 1 hour
            },
        
            configManager: {
                impl: env.CONFIG_MANAGER_IMPL,
                host: env.CONFIG_MANAGER_HOST || getHostForApp(dependencyEndpoints, 'config-manager', 'service') || 'http://config-manager-service.config-manager-ci.svc.cluster.local:8081',
                auth: env.CONFIG_MANAGER_AUTH,
                insecure: (env.CONFIG_MANAGER_INSECURE === 'true') ? true : false,
                revalidationInterval: parseIntEnv('CONFIG_MANAGER_INTERVAL', 60 * 60) // 1 hour
            },
        
            contentServer: {
                impl: env.CONTENT_SERVER_IMPL,
                host: env.CONTENT_SERVER_HOST || getHostForApp(dependencyEndpoints, 'content-server', 'service') || 'http://insights-advisor-api.advisor-ci.svc.cluster.local:8000',
                auth: env.CONTENT_SERVER_AUTH || '',
                insecure: (env.CONTENT_SERVER_INSECURE === 'false') ? false : true,
                revalidationInterval: parseIntEnv('CONTENT_SERVER_REVALIDATION_INVERVAL', 60 * 60) // 1 hour
            },
        
            dispatcher: {
                impl: env.PLAYBOOK_DISPATCHER_IMPL,
                host: env.PLAYBOOK_DISPATCHER_HOST || getHostForApp(dependencyEndpoints, 'host-inventory', 'service') || 'http://playbook-dispatcher-api.playbook-dispatcher-ci.svc.cluster.local:8000',
                auth: env.PLAYBOOK_DISPATCHER_AUTH || '',
                insecure: (env.PLAYBOOK_DISPATCHER_INSECURE === 'true') ? true : false,
                revalidationInterval: parseIntEnv('PLAYBOOK_DISPATCHER_REVALIDATION_INTERVAL', 60 * 60) // 1 hour
            },
        
            inventory: {
                impl: env.INVENTORY_IMPL,
                host: env.INVENTORY_HOST || getHostForApp(dependencyEndpoints, 'host-inventory', 'service') || 'http://insights-inventory.platform-ci.svc.cluster.local:8080',
                insecure: (env.INVENTORY_INSECURE === 'true') ? true : false,
                revalidationInterval: parseIntEnv('INVENTORY_REVALIDATION_INVERVAL', 60 * 60), // 1 hour
                pageSize: parseIntEnv('INVENTORY_PAGE_SIZE', 100),
                xjoinHost: env.XJOIN_SEARCH_URL || 'http://localhost:4000/graphql'
            },

            patchman: {
                impl: env.PATCHMAN_IMPL,
                host: env.PATCHMAN_HOST || getHostForApp(dependencyEndpoints, 'patchman', 'service') || 'http://localhost:8080',
                revalidationInterval: parseIntEnv('PATCHMAN_REVALIDATION_INVERVAL', 60 * 60 * 12) // 12 hours
            },

            rbac: {
                impl: env.RBAC_IMPL,
                host: env.RBAC_HOST || getHostForApp(dependencyEndpoints, 'rbac', 'service') || 'http://localhost:8080',
                insecure: (env.RBAC_INSECURE === 'true') ? true : false,
                enforce: env.RBAC_ENFORCE === 'false' ? false : true
            },

            receptor: {
                impl: env.RECEPTOR_IMPL,
                host: env.RECEPTOR_HOST || getHostForApp(dependencyEndpoints, 'receptor', 'service') || 'http://localhost:9090',
            },

            sources: {
                impl: env.SOURCES_IMPL,
                host: env.SOURCES_HOST || getHostForApp(dependencyEndpoints, 'sources', 'service') || 'http://localhost:8080',
            },

            ssg: {
                impl: env.SSG_IMPL,
                host: env.SSG_HOST || 'http://localhost:8090'
            },

            users: {
                impl: env.USERS_IMPL,
                host: env.USERS_HOST || 'https://insights-services-pipeline-insights.ext.paas.redhat.com',
                auth: env.USERS_AUTH || '',
                clientId: env.USERS_CLIENT_ID || 'remediations',
                env: env.USERS_ENV || 'prod',
                insecure: (env.USERS_INSECURE === 'true') ? true : false,
                revalidationInterval: parseIntEnv('USERS_REVALIDATION_INVERVAL', 60 * 60 * 12) // 12 hours
            },

            vmaas: {
                impl: env.VMAAS_IMPL,
                host: env.VMAAS_HOST || 'https://webapp-vmaas-prod.apps.crcp01ue1.o9m8.p1.openshiftapps.com',
                revalidationInterval: parseIntEnv('VMAAS_REVALIDATION_INVERVAL', 60 * 60 * 12) // 12 hours
            },

            vulnerabilities: {
                impl: env.VULNERABILITIES_IMPL,
                host: env.VULNERABILITIES_HOST || 'https://access.qa.itop.redhat.com',
                auth: env.VULNERABILITIES_AUTH || '',
                insecure: (env.VULNERABILITIES_INSECURE === 'true') ? true : false
            },

            /*
            * Dependencies
            */
            db: {
                username: loadedConfig.database.username,
                password: loadedConfig.database.password,
                database: loadedConfig.database.name,
                host: loadedConfig.database.hostname,
                dialect: 'postgres',
                benchmark: true,
                logging: true,
                pool: {
                    min: 5,
                    max: 50
                },
                define: {
                    charset: 'utf8',
                    timestamps: false,
                    underscored: true
                },
                dialectOptions: {}
            },

            redis: {
                enabled: env.REDIS_ENABLED === 'true' ? true : false,
            },

            // responses
            fifi: {
                text_updates: env.FIFI_TEXT_UPDATES === 'false' ? false : true,
                text_update_interval: parseIntEnv('FIFI_TEXT_UPDATE_INTERVAL', 5000),
                text_update_full: env.FIFI_TEXT_UPDATE_FULL === 'false' ? false : true
            }
        }

        if (config.redis.enabled) {
            config.redis.host = loadedConfig.inMemoryDb.hostname
            config.redis.port = loadedConfig.inMemoryDb.port
            config.redis.password = loadedConfig.inMemoryDb.password 
        }
    } else {
        var config = {

            /*
             * Server configuration
             */
            env: env.NODE_ENV || 'development',
            namespace: env.NAMESPACE || 'unknown',
            port: (env.NODE_ENV === 'test') ? 9003 : 9002,
            commit: env.OPENSHIFT_BUILD_COMMIT,
            demo: (env.DEMO_MODE === 'true') ? true : false,
            platformHostname: env.PLATFORM_HOSTNAME_URL || 'hostname',
            isMarketplace: (env.MARKETPLACE_CHECK === 'true') ? true : false,
        
            bodyParserLimit: env.BODY_PARSER_LIMIT || '1mb',
        
            // by default enabled in non-prod
            validateResponseStrict: env.VALIDATE_RESPONSE_STRICT === undefined ?
                env.NODE_ENV !== 'production' :
                env.VALIDATE_RESPONSE_STRICT === 'true' ? true : false,
        
            path: {
                prefix: env.PATH_PREFIX || '/api',
                app: env.APP_NAME || 'remediations'
            },
        
            logging: {
                level: env.LOG_LEVEL || ((env.NODE_ENV === 'test') ? 'error' : 'debug'),
                pretty: (env.NODE_ENV !== 'production'),
                cloudwatch: {
                    enabled: env.LOG_CW_ENABLED === 'true',
                    level: env.LOG_CW_LEVEL || env.LOG_LEVEL || 'debug',
                    options: {
                        group: env.LOG_CW_GROUP || env.NAMESPACE || 'remediations-local',
                        prefix: env.LOG_CW_PREFIX || 'remediations-',
                        interval: parseIntEnv('LOG_CW_INTERVAL', 1000), // 1000 ms
                        aws_access_key_id: env.LOG_CW_KEY,
                        aws_secret_access_key: env.LOG_CW_SECRET,
                        aws_region: env.LOG_CW_REGION || 'us-east-1'
                    }
                }
            },
        
            metrics: {
                prefix: env.METRICS_PREFIX || 'remediations_',
                enabled: env.METRICS_ENABLED === 'false' ? false : true,
                summaryMaxAge: parseIntEnv('METRICS_SUMMARY_MAX_AGE', 10 * 60) // 10 mins
            },
        
            /*
             * Connector configuration
             */
        
            // general timeout for HTTP invocations of external services
            requestTimeout: parseInt(env.REQUEST_TIMEOUT) || 10000,
        
            cache: {
                ttl: parseIntEnv('CACHE_TTL', 24 * 60 * 60), // 24 hours
                revalidationInterval: parseIntEnv('CACHE_REVALIDATION_INVERVAL', 10 * 60) // 10 mins
            },
        
            advisor: {
                impl: env.ADVISOR_IMPL,
                host: env.ADVISOR_HOST || 'http://insights-advisor-api.advisor-ci.svc.cluster.local:8000',
                auth: env.ADVISOR_AUTH || '',
                insecure: (env.ADVISOR_INSECURE === 'true') ? true : false,
                revalidationInterval: parseIntEnv('ADVISOR_REVALIDATION_INVERVAL', 60 * 60) // 1 hour
            },
        
            compliance: {
                impl: env.COMPLIANCE_IMPL,
                host: env.COMPLIANCE_HOST || 'http://compliance-backend.compliance-ci.svc.cluster.local:3000',
                insecure: (env.COMPLIANCE_INSECURE === 'true') ? true : false,
                revalidationInterval: parseIntEnv('COMPLIANCE_REVALIDATION_INVERVAL', 60 * 60) // 1 hour
            },
        
            configManager: {
                impl: env.CONFIG_MANAGER_IMPL,
                host: env.CONFIG_MANAGER_HOST || 'http://config-manager-service.config-manager-ci.svc.cluster.local:8081',
                auth: env.CONFIG_MANAGER_AUTH,
                insecure: (env.CONFIG_MANAGER_INSECURE === 'true') ? true : false,
                revalidationInterval: parseIntEnv('CONFIG_MANAGER_INTERVAL', 60 * 60) // 1 hour
            },
        
            contentServer: {
                impl: env.CONTENT_SERVER_IMPL,
                host: env.CONTENT_SERVER_HOST || 'http://insights-advisor-api.advisor-ci.svc.cluster.local:8000',
                auth: env.CONTENT_SERVER_AUTH || '',
                insecure: (env.CONTENT_SERVER_INSECURE === 'false') ? false : true,
                revalidationInterval: parseIntEnv('CONTENT_SERVER_REVALIDATION_INVERVAL', 60 * 60) // 1 hour
            },
        
            dispatcher: {
                impl: env.PLAYBOOK_DISPATCHER_IMPL,
                host: env.PLAYBOOK_DISPATCHER_HOST || 'http://playbook-dispatcher-api.playbook-dispatcher-ci.svc.cluster.local:8000',
                auth: env.PLAYBOOK_DISPATCHER_AUTH || '',
                insecure: (env.PLAYBOOK_DISPATCHER_INSECURE === 'true') ? true : false,
                revalidationInterval: parseIntEnv('PLAYBOOK_DISPATCHER_REVALIDATION_INTERVAL', 60 * 60) // 1 hour
            },
        
            inventory: {
                impl: env.INVENTORY_IMPL,
                host: env.INVENTORY_HOST || 'http://insights-inventory.platform-ci.svc.cluster.local:8080',
                insecure: (env.INVENTORY_INSECURE === 'true') ? true : false,
                revalidationInterval: parseIntEnv('INVENTORY_REVALIDATION_INVERVAL', 60 * 60), // 1 hour
                pageSize: parseIntEnv('INVENTORY_PAGE_SIZE', 100),
                xjoinHost: env.XJOIN_SEARCH_URL || 'http://localhost:4000/graphql'
            },
        
            patchman: {
                impl: env.PATCHMAN_IMPL,
                host: env.PATCHMAN_HOST || 'http://localhost:8080',
                revalidationInterval: parseIntEnv('PATCHMAN_REVALIDATION_INVERVAL', 60 * 60 * 12) // 12 hours
            },
        
            rbac: {
                impl: env.RBAC_IMPL,
                host: env.RBAC_HOST || 'http://localhost:8080',
                insecure: (env.RBAC_INSECURE === 'true') ? true : false,
                enforce: env.RBAC_ENFORCE === 'false' ? false : true
            },
        
            receptor: {
                impl: env.RECEPTOR_IMPL,
                host: env.RECEPTOR_HOST || 'http://localhost:9090'
            },
        
            sources: {
                impl: env.SOURCES_IMPL,
                host: env.SOURCES_HOST || 'http://localhost:8080'
            },
        
            ssg: {
                impl: env.SSG_IMPL,
                host: env.SSG_HOST || 'http://localhost:8090'
            },
        
            users: {
                impl: env.USERS_IMPL,
                host: env.USERS_HOST || 'https://insights-services-pipeline-insights.ext.paas.redhat.com',
                auth: env.USERS_AUTH || '',
                clientId: env.USERS_CLIENT_ID || 'remediations',
                env: env.USERS_ENV || 'prod',
                testAccount: env.USERS_TEST_ACCOUNT || 'someUsername',
                insecure: (env.USERS_INSECURE === 'true') ? true : false,
                revalidationInterval: parseIntEnv('USERS_REVALIDATION_INVERVAL', 60 * 60 * 12) // 12 hours
            },
        
            vmaas: {
                impl: env.VMAAS_IMPL,
                host: env.VMAAS_HOST || 'https://webapp-vmaas-prod.apps.crcp01ue1.o9m8.p1.openshiftapps.com',
                revalidationInterval: parseIntEnv('VMAAS_REVALIDATION_INVERVAL', 60 * 60 * 12) // 12 hours
            },
        
            vulnerabilities: {
                impl: env.VULNERABILITIES_IMPL,
                host: env.VULNERABILITIES_HOST || 'https://access.qa.itop.redhat.com',
                auth: env.VULNERABILITIES_AUTH || '',
                insecure: (env.VULNERABILITIES_INSECURE === 'true') ? true : false
            },
        
            /*
             * Dependencies
             */
            db: {
                username: env.DB_USERNAME || 'postgres',
                password: env.DB_PASSWORD || 'remediations',
                database: env.DB_DATABASE || 'remediations',
                host: env.DB_HOST || '127.0.0.1',
                dialect: 'postgres',
                benchmark: true,
                logging: true,
                pool: {
                    min: 5,
                    max: 50
                },
                define: {
                    charset: 'utf8',
                    timestamps: false,
                    underscored: true
                },
                dialectOptions: {}
            },
        
            redis: {
                enabled: env.REDIS_ENABLED === 'true' ? true : false,
                host: env.REDIS_HOST || 'localhost',
                port: parseIntEnv('REDIS_PORT', 6379),
                password: env.REDIS_PASSWORD || undefined
            },
        
            // responses
            fifi: {
                text_updates: env.FIFI_TEXT_UPDATES === 'false' ? false : true,
                text_update_interval: parseIntEnv('FIFI_TEXT_UPDATE_INTERVAL', 5000),
                text_update_full: env.FIFI_TEXT_UPDATE_FULL === 'false' ? false : true
            }
        };
    }
}

config.path.base = `${config.path.prefix}/${config.path.app}`;

if (env.DB_SSL_ENABLED !== 'false' && env.DB_CA) {
    config.db.ssl = true;
    config.db.dialectOptions.ssl = {
        ca: fs.readFileSync(env.DB_CA) // eslint-disable-line security/detect-non-literal-fs-filename
    };
}

if (['development', 'production', 'test'].includes(config.env)) {
    if (fs.existsSync(path.join(__dirname, `${config.env}.js`))) { // eslint-disable-line security/detect-non-literal-fs-filename
        _.merge(config, require(`./${config.env}`)); // eslint-disable-line security/detect-non-literal-require
    }
}

module.exports = config;

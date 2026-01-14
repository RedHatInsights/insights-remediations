'use strict';

const Connector = require('../Connector');
const config = require('../../config');
const log = require('../../util/log');

let startUnleash = null;
let destroy = null;
try {
    const unleashClient = require('unleash-client');
    startUnleash = unleashClient.startUnleash;
    destroy = unleashClient.destroy;
} catch (error) {
    log.warn('Unleash client not available:', error.message);
}

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.client = null;
        this.initialized = false;
        this.ready = false;

        if (config.featureFlags.enabled && startUnleash) {
            if (!config.featureFlags.host || !config.featureFlags.token) {
                log.warn('Feature flags enabled but host or token not configured, skipping initialization');
            } else {
                this.initialize();
            }
        }
    }

    async initialize () {
        try {
            this.client = await startUnleash({
                url: config.featureFlags.host,
                appName: config.featureFlags.appName,
                refreshInterval: config.featureFlags.refreshInterval,
                metricsInterval: config.featureFlags.metricsInterval,
                customHeaders: {
                    Authorization: config.featureFlags.token
                }
            });

            this.client.on('ready', () => {
                log.info('Feature flags client ready (loaded from cache)');
                this.ready = true;
            });

            this.client.on('synchronized', () => {
                log.info('Feature flags client synchronized with server');
                this.ready = true;
            });

            this.client.on('error', (err) => {
                log.error({ error: err }, 'Feature flags client error');
            });

            this.client.on('warn', (msg) => {
                log.warn({ message: msg }, 'Feature flags client warning');
            });

            this.initialized = true;
            log.info('Feature flags client initialized successfully');
        } catch (error) {
            log.error({ error }, 'Failed to initialize feature flags client');
            this.initialized = false;
        }
    }

    isEnabled (featureName, context = {}) {
        if (!config.featureFlags.enabled || !this.initialized || !this.client) {
            return false;
        }

        return this.client.isEnabled(featureName, context);
    }

    getVariant (featureName, context = {}) {
        if (!config.featureFlags.enabled || !this.initialized || !this.client) {
            return { name: 'disabled', enabled: false };
        }

        return this.client.getVariant(featureName, context);
    }

    isReady () {
        return this.ready;
    }

    async close () {
        if (this.client && destroy) {
            destroy();
            this.client = null;
            this.initialized = false;
            this.ready = false;
            log.info('Feature flags client destroyed');
        }
    }

    async ping () {
        if (!config.featureFlags.enabled) {
            return true;
        }

        return this.initialized && this.ready;
    }
}();

'use strict';

const Connector = require('../Connector');

const MOCK_FLAGS = {};

const MOCK_VARIANTS = {};

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    isEnabled (featureName) {
        if (featureName in MOCK_FLAGS) {
            return MOCK_FLAGS[featureName];
        }

        return false;
    }

    getVariant (featureName) {
        if (featureName in MOCK_VARIANTS) {
            return MOCK_VARIANTS[featureName];
        }

        return { name: 'disabled', enabled: false };
    }

    isReady () {
        return true;
    }

    async close () {
        // no-op for mock
    }

    async ping () {
        return true;
    }
}();

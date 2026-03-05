'use strict';

const path = require('path');

describe('Configuration', () => {
    test('Verify app-common-js function', () => {
        process.env.ACG_CONFIG = path.resolve('src/config/test.json');
        const config = require('.');

        expect(config).toMatchSnapshot();
    });
});

describe('getExposedConfig', () => {
    const { getExposedConfig } = require('.');

    test('returns only explicitly exposed config values', () => {
        const result = getExposedConfig();

        // Should contain planRetentionDays
        expect(result).toHaveProperty('planRetentionDays');
        expect(typeof result.planRetentionDays).toBe('number');
    });

    test('does not expose sensitive config values', () => {
        const result = getExposedConfig();

        // Ensure sensitive values are not exposed
        expect(result).not.toHaveProperty('db');
        expect(result).not.toHaveProperty('redis');
        expect(result).not.toHaveProperty('kessel');
        expect(result).not.toHaveProperty('users');
        expect(result).not.toHaveProperty('logging');
    });

    test('returns expected structure', () => {
        const result = getExposedConfig();

        // The exposed config should only contain the explicitly defined keys
        const keys = Object.keys(result);
        expect(keys).toEqual(['planRetentionDays']);
    });
});

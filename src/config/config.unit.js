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

    test('extracts exposed config values', () => {
        const testConfig = {
            simpleValue: 'not exposed',
            exposedValue: {
                value: 'test-value',
                exposed: true
            },
            nested: {
                notExposed: 'hidden',
                alsoExposed: {
                    value: 42,
                    exposed: true
                }
            }
        };

        const result = getExposedConfig(testConfig);

        expect(result).toEqual({
            exposedValue: 'test-value',
            'nested.alsoExposed': 42
        });
    });

    test('returns empty object when no exposed values exist', () => {
        const testConfig = {
            hidden: 'value',
            nested: {
                alsoHidden: 'secret'
            }
        };

        const result = getExposedConfig(testConfig);

        expect(result).toEqual({});
    });

    test('ignores exposed: true without value property', () => {
        const testConfig = {
            incomplete: {
                exposed: true
                // missing 'value' property
            }
        };

        const result = getExposedConfig(testConfig);

        expect(result).toEqual({});
    });

    test('ignores exposed: false with value property', () => {
        const testConfig = {
            notReallyExposed: {
                value: 'should-be-hidden',
                exposed: false
            }
        };

        const result = getExposedConfig(testConfig);

        expect(result).toEqual({});
    });

    test('extracts remediationRetentionDays from actual config', () => {
        const result = getExposedConfig();

        expect(result).toHaveProperty('remediationRetentionDays');
        expect(typeof result.remediationRetentionDays).toBe('number');
    });
});

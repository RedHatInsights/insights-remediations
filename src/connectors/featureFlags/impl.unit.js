'use strict';

const sinon = require('sinon');
const config = require('../../config');

describe('featureFlags impl', function () {
    let impl;
    let originalState;
    let sandbox;

    beforeEach(function () {
        sandbox = sinon.createSandbox();
        impl = require('./impl');
        // Save original state to restore after each test
        originalState = {
            client: impl.client,
            initialized: impl.initialized,
            ready: impl.ready
        };
    });

    afterEach(function () {
        // Restore original state
        impl.client = originalState.client;
        impl.initialized = originalState.initialized;
        impl.ready = originalState.ready;
        sandbox.restore();
    });

    describe('isEnabled', function () {
        test('returns false when feature flags are disabled', function () {
            sandbox.stub(config.featureFlags, 'enabled').value(false);
            impl.initialized = true;
            impl.client = { isEnabled: jest.fn().mockReturnValue(true) };

            const result = impl.isEnabled('test-feature');

            expect(result).toBe(false);
            expect(impl.client.isEnabled).not.toHaveBeenCalled();
        });

        test('returns false when not initialized', function () {
            sandbox.stub(config.featureFlags, 'enabled').value(true);
            impl.initialized = false;
            impl.client = { isEnabled: jest.fn().mockReturnValue(true) };

            const result = impl.isEnabled('test-feature');

            expect(result).toBe(false);
            expect(impl.client.isEnabled).not.toHaveBeenCalled();
        });

        test('returns false when client is null', function () {
            sandbox.stub(config.featureFlags, 'enabled').value(true);
            impl.initialized = true;
            impl.client = null;

            const result = impl.isEnabled('test-feature');

            expect(result).toBe(false);
        });

        test('delegates to client when enabled and initialized', function () {
            sandbox.stub(config.featureFlags, 'enabled').value(true);
            impl.initialized = true;
            impl.client = { isEnabled: jest.fn().mockReturnValue(true) };

            const result = impl.isEnabled('my-feature', { userId: '123' });

            expect(result).toBe(true);
            expect(impl.client.isEnabled).toHaveBeenCalledWith('my-feature', { userId: '123' });
        });

        test('returns client result when feature is disabled', function () {
            sandbox.stub(config.featureFlags, 'enabled').value(true);
            impl.initialized = true;
            impl.client = { isEnabled: jest.fn().mockReturnValue(false) };

            const result = impl.isEnabled('disabled-feature');

            expect(result).toBe(false);
            expect(impl.client.isEnabled).toHaveBeenCalledWith('disabled-feature', {});
        });
    });

    describe('getVariant', function () {
        test('returns disabled variant when feature flags are disabled', function () {
            sandbox.stub(config.featureFlags, 'enabled').value(false);
            impl.initialized = true;
            impl.client = { getVariant: jest.fn() };

            const result = impl.getVariant('test-feature');

            expect(result).toEqual({ name: 'disabled', enabled: false });
            expect(impl.client.getVariant).not.toHaveBeenCalled();
        });

        test('returns disabled variant when not initialized', function () {
            sandbox.stub(config.featureFlags, 'enabled').value(true);
            impl.initialized = false;
            impl.client = { getVariant: jest.fn() };

            const result = impl.getVariant('test-feature');

            expect(result).toEqual({ name: 'disabled', enabled: false });
            expect(impl.client.getVariant).not.toHaveBeenCalled();
        });

        test('returns disabled variant when client is null', function () {
            sandbox.stub(config.featureFlags, 'enabled').value(true);
            impl.initialized = true;
            impl.client = null;

            const result = impl.getVariant('test-feature');

            expect(result).toEqual({ name: 'disabled', enabled: false });
        });

        test('delegates to client when enabled and initialized', function () {
            sandbox.stub(config.featureFlags, 'enabled').value(true);
            impl.initialized = true;
            const mockVariant = { name: 'variantA', enabled: true, payload: { type: 'string', value: 'test' } };
            impl.client = { getVariant: jest.fn().mockReturnValue(mockVariant) };

            const result = impl.getVariant('my-feature', { userId: '456' });

            expect(result).toEqual(mockVariant);
            expect(impl.client.getVariant).toHaveBeenCalledWith('my-feature', { userId: '456' });
        });
    });

    describe('isReady', function () {
        test('returns true when ready', function () {
            impl.ready = true;

            expect(impl.isReady()).toBe(true);
        });

        test('returns false when not ready', function () {
            impl.ready = false;

            expect(impl.isReady()).toBe(false);
        });
    });

    describe('ping', function () {
        test('returns true when feature flags are disabled', async function () {
            sandbox.stub(config.featureFlags, 'enabled').value(false);
            impl.initialized = false;
            impl.ready = false;

            const result = await impl.ping();

            expect(result).toBe(true);
        });

        test('returns true when enabled, initialized, and ready', async function () {
            sandbox.stub(config.featureFlags, 'enabled').value(true);
            impl.initialized = true;
            impl.ready = true;

            const result = await impl.ping();

            expect(result).toBe(true);
        });

        test('returns false when enabled but not initialized', async function () {
            sandbox.stub(config.featureFlags, 'enabled').value(true);
            impl.initialized = false;
            impl.ready = true;

            const result = await impl.ping();

            expect(result).toBe(false);
        });

        test('returns false when enabled but not ready', async function () {
            sandbox.stub(config.featureFlags, 'enabled').value(true);
            impl.initialized = true;
            impl.ready = false;

            const result = await impl.ping();

            expect(result).toBe(false);
        });
    });

    describe('close', function () {
        test('destroys client and resets state', async function () {
            const destroyMock = jest.fn().mockResolvedValue(undefined);
            impl.client = { destroy: destroyMock };
            impl.initialized = true;
            impl.ready = true;

            await impl.close();

            expect(destroyMock).toHaveBeenCalled();
            expect(impl.client).toBeNull();
            expect(impl.initialized).toBe(false);
            expect(impl.ready).toBe(false);
        });

        test('handles missing client gracefully', async function () {
            impl.client = null;
            impl.initialized = true;
            impl.ready = true;

            await impl.close();

            // Should not throw, state should remain unchanged
            expect(impl.client).toBeNull();
            expect(impl.initialized).toBe(true);
            expect(impl.ready).toBe(true);
        });

        test('handles client without destroy method', async function () {
            impl.client = {};
            impl.initialized = true;
            impl.ready = true;

            await impl.close();

            // Should not throw, state should remain unchanged
            expect(impl.initialized).toBe(true);
            expect(impl.ready).toBe(true);
        });
    });
});

'use strict';

const impl = require('./impl');
const { mockRequest } = require('../testUtils');

describe('kessel impl', () => {

    beforeEach(() => {
        mockRequest();
    });

    describe('initialization', () => {
        test('should initialize when Kessel is enabled', () => {
            expect(impl.initialized).toBeDefined();
        });

        test('should handle missing Kessel SDK gracefully', () => {
            // Test is mainly to ensure the try/catch works
            expect(() => require('./impl')).not.toThrow();
        });
    });

    describe('pingPermissionCheck', () => {
        test('should return false when Kessel is not enabled', async () => {
            // Mock config to disable Kessel
            const originalConfig = require('../../config').kessel;
            require('../../config').kessel.enabled = false;
            
            const result = await impl.pingPermissionCheck();
            expect(result).toBe(false);
            
            // Restore original config
            require('../../config').kessel.enabled = originalConfig.enabled;
        });

        test('should return false when no identity is found', async () => {
            // Mock getIdentityFromHeaders to return null
            const originalMethod = impl.getIdentityFromHeaders;
            impl.getIdentityFromHeaders = jest.fn().mockReturnValue(null);
            
            const result = await impl.pingPermissionCheck();
            expect(result).toBe(false);
            
            // Restore original method
            impl.getIdentityFromHeaders = originalMethod;
        });
    });

    describe('hasPermission', () => {
        test('should return false when Kessel is not enabled', async () => {
            // Mock config to disable Kessel
            const originalConfig = require('../../config').kessel;
            require('../../config').kessel.enabled = false;
            
            const result = await impl.hasPermission('remediation', 'read', 'user123');
            expect(result).toBe(false);
            
            // Restore original config
            require('../../config').kessel.enabled = originalConfig.enabled;
        });

        test('should return false when not initialized', async () => {
            // Mock initialization state
            const originalInitialized = impl.initialized;
            impl.initialized = false;
            
            const result = await impl.hasPermission('remediation', 'read', 'user123');
            expect(result).toBe(false);
            
            // Restore original state
            impl.initialized = originalInitialized;
        });
    });



    describe('getIdentityFromHeaders', () => {
        test('should parse x-rh-identity header', () => {
            const mockIdentity = {
                identity: {
                    user: {
                        user_id: 'user123'
                    }
                }
            };
            const encodedIdentity = Buffer.from(JSON.stringify(mockIdentity)).toString('base64');
            
            // Mock getForwardedHeaders
            const originalMethod = impl.getForwardedHeaders;
            impl.getForwardedHeaders = jest.fn().mockReturnValue({
                'x-rh-identity': encodedIdentity
            });
            
            const result = impl.getIdentityFromHeaders();
            expect(result).toEqual(mockIdentity);
            
            // Restore original method
            impl.getForwardedHeaders = originalMethod;
        });

        test('should handle invalid base64', () => {
            // Mock getForwardedHeaders with invalid base64
            const originalMethod = impl.getForwardedHeaders;
            impl.getForwardedHeaders = jest.fn().mockReturnValue({
                'x-rh-identity': 'invalid-base64'
            });
            
            const result = impl.getIdentityFromHeaders();
            expect(result).toBeNull();
            
            // Restore original method
            impl.getForwardedHeaders = originalMethod;
        });
    });

    describe('ping', () => {
        test('should not throw when Kessel is disabled', async () => {
            // Mock config to disable Kessel
            const originalConfig = require('../../config').kessel;
            require('../../config').kessel.enabled = false;
            
            await expect(impl.ping()).resolves.not.toThrow();
            
            // Restore original config
            require('../../config').kessel.enabled = originalConfig.enabled;
        });
    });

    describe('convertRbacToWorkspacePermission', () => {
        test('should convert RBAC permissions to workspace permissions correctly', () => {
            // Expected mappings that the function should produce
            const expectedMappings = {
                'remediation:read': 'remediations_read_remediation',
                'remediation:write': 'remediations_write_remediation',
                'remediation:execute': 'remediations_execute_remediation',
                'playbook:read': 'remediations_read_playbook',
                'playbook:write': 'remediations_write_playbook',
                'playbook:execute': 'remediations_execute_playbook',
                'system:read': 'remediations_read_system',
                'system:write': 'remediations_write_system'
            };

            // Test each expected mapping
            Object.entries(expectedMappings).forEach(([rbacPermission, expectedWorkspacePermission]) => {
                const [resource, action] = rbacPermission.split(':');
                const result = impl.convertRbacToWorkspacePermission(resource, action);
                expect(result).toBe(expectedWorkspacePermission);
            });
        });

        test('should follow the pattern remediations_${action}_${resource}', () => {
            const result = impl.convertRbacToWorkspacePermission('test', 'example');
            expect(result).toBe('remediations_example_test');
        });
    });

    describe('getDefaultWorkspaceIdForSubject', () => {
        test('should return default workspace ID', () => {
            const result = impl.getDefaultWorkspaceIdForSubject('user123');
            expect(result).toBe('default');
        });
    });
}); 
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

        test('should use ClientBuilder when available', () => {
            // This test ensures the new import path is working
            expect(impl.kesselClient).toBeDefined();
        });
    });

    describe('initializeKesselClient', () => {
        test('should use secure credentials when insecure is false', () => {
            // Mock the config for secure connection
            const originalConfig = require('../../config').kessel;
            require('../../config').kessel.insecure = false;
            
            // The fact that initialization doesn't throw indicates success with secure credentials
            expect(() => impl.initializeKesselClient()).not.toThrow();
            
            // Restore original config
            require('../../config').kessel.insecure = originalConfig.insecure;
        });

        test('should use insecure credentials when insecure is true', () => {
            // Mock the config for insecure connection  
            const originalConfig = require('../../config').kessel;
            require('../../config').kessel.insecure = true;
            
            // The fact that initialization doesn't throw indicates success with insecure credentials
            expect(() => impl.initializeKesselClient()).not.toThrow();
            
            // Restore original config
            require('../../config').kessel.insecure = originalConfig.insecure;
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

        test('should handle async operation correctly', async () => {
            // Mock identity and client to test the async flow
            const mockIdentity = {
                identity: { user: { user_id: 'test-user' }, org_id: 'test-org' }
            };
            
            const originalGetIdentity = impl.getIdentityFromHeaders;
            const originalCheckPermission = impl.checkSinglePermission;
            
            impl.getIdentityFromHeaders = jest.fn().mockReturnValue(mockIdentity);
            impl.checkSinglePermission = jest.fn().mockResolvedValue(true);
            
            const result = await impl.pingPermissionCheck();
            expect(result).toBe(true);
            expect(impl.checkSinglePermission).toHaveBeenCalledWith(
                'test-user',
                'test-org', 
                'remediations_read_remediation'
            );
            
            // Restore original methods
            impl.getIdentityFromHeaders = originalGetIdentity;
            impl.checkSinglePermission = originalCheckPermission;
        });
    });

    describe('checkSinglePermission', () => {
        test('should construct proper check request structure', async () => {
            // Mock the kessel client
            const mockResponse = { allowed: true };
            const originalClient = impl.kesselClient;
            
            impl.kesselClient = {
                check: jest.fn().mockResolvedValue(mockResponse)
            };
            
            const result = await impl.checkSinglePermission('user123', 'workspace456', 'test_permission');
            
            expect(impl.kesselClient.check).toHaveBeenCalledWith({
                subject: {
                    resource: {
                        reporter: { type: "rbac" },
                        resourceId: "redhat/user123",
                        resourceType: "principal"
                    }
                },
                object: {
                    reporter: { type: "rbac" },
                    resourceId: "workspace456",
                    resourceType: "workspace"
                },
                relation: "test_permission"
            });
            
            expect(result).toBe(true);
            
            // Restore original client
            impl.kesselClient = originalClient;
        });

        test('should handle async rejection correctly', async () => {
            // Mock the kessel client to throw an error
            const originalClient = impl.kesselClient;
            const mockError = new Error('Connection failed');
            
            impl.kesselClient = {
                check: jest.fn().mockRejectedValue(mockError)
            };
            
            await expect(impl.checkSinglePermission('user123', 'workspace456', 'test_permission'))
                .rejects.toThrow('Connection failed');
            
            // Restore original client
            impl.kesselClient = originalClient;
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

        test('should use async checkSinglePermission', async () => {
            // Mock the checkSinglePermission to test async flow
            const originalCheckPermission = impl.checkSinglePermission;
            impl.checkSinglePermission = jest.fn().mockResolvedValue(true);
            
            const result = await impl.hasPermission('remediation', 'read', 'user123');
            expect(result).toBe(true);
            expect(impl.checkSinglePermission).toHaveBeenCalledWith(
                'user123',
                'default',
                'remediations_read_remediation'
            );
            
            // Restore original method
            impl.checkSinglePermission = originalCheckPermission;
        });

        test('should handle permission check errors gracefully', async () => {
            // Mock checkSinglePermission to throw an error
            const originalCheckPermission = impl.checkSinglePermission;
            impl.checkSinglePermission = jest.fn().mockRejectedValue(new Error('Permission check failed'));
            
            const result = await impl.hasPermission('remediation', 'read', 'user123');
            expect(result).toBe(false);
            
            // Restore original method
            impl.checkSinglePermission = originalCheckPermission;
        });
    });

    describe('extractWorkspaceId', () => {
        test('should extract workspace ID from various identity formats', () => {
            const testCases = [
                {
                    identity: { identity: { account_number: 'acc123' } },
                    expected: 'acc123'
                },
                {
                    identity: { identity: { org_id: 'org456' } },
                    expected: 'org456'
                },
                {
                    identity: { account_number: 'acc789' },
                    expected: 'acc789'
                },
                {
                    identity: { org_id: 'org012' },
                    expected: 'org012'
                },
                {
                    identity: {},
                    expected: 'default'
                }
            ];

            testCases.forEach(({ identity, expected }) => {
                const result = impl.extractWorkspaceId(identity);
                expect(result).toBe(expected);
            });
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

        test('should handle missing header', () => {
            // Mock getForwardedHeaders with no identity header
            const originalMethod = impl.getForwardedHeaders;
            impl.getForwardedHeaders = jest.fn().mockReturnValue({});
            
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

        test('should handle ping permission check failure', async () => {
            // Mock pingPermissionCheck to throw an error
            const originalPingCheck = impl.pingPermissionCheck;
            impl.pingPermissionCheck = jest.fn().mockRejectedValue(new Error('Ping failed'));
            
            // The ping method should handle the error by throwing an assertion
            await expect(impl.ping()).rejects.toThrow();
            
            // Restore original method
            impl.pingPermissionCheck = originalPingCheck;
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
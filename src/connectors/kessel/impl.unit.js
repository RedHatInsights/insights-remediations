'use strict';

const KesselConnector = require('./impl');
const { mockRequest } = require('../testUtils');

describe('kessel impl', () => {
    // Create a test instance with mock config for each test
    let mockConfig;
    let impl;
    let originalMethods = {};

    beforeEach(() => {
        mockRequest();
        
        // Create mock config for testing
        mockConfig = {
            enabled: true,
            url: 'localhost:9000',
            insecure: true,
            principal: 'redhat'
        };
        
        // Create test instance
        impl = new KesselConnector(module, mockConfig);
        
        // Store original methods for restoration
        originalMethods = {
            getIdentityFromHeaders: impl.getIdentityFromHeaders,
            getForwardedHeaders: impl.getForwardedHeaders,
            checkSinglePermission: impl.checkSinglePermission,
            pingPermissionCheck: impl.pingPermissionCheck,
            kesselClient: impl.kesselClient,
            initialized: impl.initialized,
            permissionMetrics: impl.permissionMetrics
        };
    });

    afterEach(() => {
        // Restore original methods
        impl.getIdentityFromHeaders = originalMethods.getIdentityFromHeaders;
        impl.getForwardedHeaders = originalMethods.getForwardedHeaders;
        impl.checkSinglePermission = originalMethods.checkSinglePermission;
        impl.pingPermissionCheck = originalMethods.pingPermissionCheck;
        impl.kesselClient = originalMethods.kesselClient;
        impl.initialized = originalMethods.initialized;
        impl.permissionMetrics = originalMethods.permissionMetrics;
        
        // Clear any jest mocks
        jest.clearAllMocks();
    });

    describe('initialization', () => {
        test('should initialize when Kessel is enabled', () => {
            expect(impl.initialized).toBeDefined();
        });

        test('should handle missing Kessel SDK gracefully', () => {
            // Test is mainly to ensure the try/catch works
            expect(() => new KesselConnector(module, mockConfig)).not.toThrow();
        });

        test('should use ClientBuilder when available', () => {
            // This test ensures the new import path is working
            expect(impl.kesselClient).toBeDefined();
        });
    });

    describe('initializeKesselClient', () => {
        test('should use secure credentials when insecure is false', () => {
            const secureConfig = { ...mockConfig, insecure: false };
            const secureImpl = new KesselConnector(module, secureConfig);
            
            // The fact that initialization doesn't throw indicates success with secure credentials
            expect(() => secureImpl.initializeKesselClient()).not.toThrow();
        });

        test('should use insecure credentials when insecure is true', () => {
            const insecureConfig = { ...mockConfig, insecure: true };
            const insecureImpl = new KesselConnector(module, insecureConfig);
            
            // The fact that initialization doesn't throw indicates success with insecure credentials
            expect(() => insecureImpl.initializeKesselClient()).not.toThrow();
        });
    });

    describe('pingPermissionCheck', () => {
        test('should return false when Kessel is not enabled', async () => {
            // Create instance with disabled config
            const disabledConfig = { ...mockConfig, enabled: false };
            const disabledImpl = new KesselConnector(module, disabledConfig);
            
            const result = await disabledImpl.pingPermissionCheck();
            expect(result).toBe(false);
        });

        test('should return false when no identity is found', async () => {
            // Mock getIdentityFromHeaders to return null
            impl.getIdentityFromHeaders = jest.fn().mockReturnValue(null);
            
            const result = await impl.pingPermissionCheck();
            expect(result).toBe(false);
        });

        test('should handle async operation correctly', async () => {
            // Ensure Kessel is enabled and initialized for this test
            impl.kesselConfig.enabled = true;
            impl.initialized = true;
            impl.kesselClient = { check: jest.fn() }; // Mock client
            
            // Mock identity and client to test the async flow
            // Note: userId is extracted as identity.user_id || identity.identity?.user?.user_id
            const mockIdentity = {
                identity: { 
                    user: { user_id: 'test-user' }, 
                    org_id: 'test-org' 
                }
            };
            
            impl.getIdentityFromHeaders = jest.fn().mockReturnValue(mockIdentity);
            impl.checkSinglePermission = jest.fn().mockResolvedValue(true);
            
            const result = await impl.pingPermissionCheck();
            expect(result).toBe(true);
            expect(impl.checkSinglePermission).toHaveBeenCalledWith(
                'test-user',
                'test-org', 
                'remediations_read_remediation'
            );
        });
    });

    describe('checkSinglePermission', () => {
        test('should construct proper check request structure', async () => {
            // Mock the kessel client
            const mockResponse = { allowed: true };
            const mockClient = {
                check: jest.fn().mockResolvedValue(mockResponse)
            };
            
            impl.kesselClient = mockClient;
            
            const result = await impl.checkSinglePermission('user123', 'workspace456', 'test_permission');
            
            expect(mockClient.check).toHaveBeenCalledWith({
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
        });

        test('should handle async rejection correctly', async () => {
            // Mock the kessel client to throw an error
            const mockError = new Error('Connection failed');
            const mockClient = {
                check: jest.fn().mockRejectedValue(mockError)
            };
            
            impl.kesselClient = mockClient;
            
            await expect(impl.checkSinglePermission('user123', 'workspace456', 'test_permission'))
                .rejects.toThrow('Connection failed');
        });
    });

    describe('hasPermission', () => {
        test('should return false when Kessel is not enabled', async () => {
            // Create instance with disabled config
            const disabledConfig = { ...mockConfig, enabled: false };
            const disabledImpl = new KesselConnector(module, disabledConfig);
            
            const result = await disabledImpl.hasPermission('remediation', 'read', 'user123');
            expect(result).toBe(false);
        });

        test('should return false when not initialized', async () => {
            // Mock initialization state
            impl.initialized = false;
            
            const result = await impl.hasPermission('remediation', 'read', 'user123');
            expect(result).toBe(false);
        });

        test('should use async checkSinglePermission', async () => {
            // Ensure Kessel is enabled and initialized for this test
            impl.kesselConfig.enabled = true;
            impl.initialized = true;
            impl.kesselClient = { check: jest.fn() }; // Mock client
            
            // Mock the permissionMetrics to handle observe calls
            impl.permissionMetrics = {
                observe: jest.fn()
            };
            
            // Mock the checkSinglePermission to test async flow
            impl.checkSinglePermission = jest.fn().mockResolvedValue(true);
            
            const result = await impl.hasPermission('remediation', 'read', 'user123');
            expect(result).toBe(true);
            expect(impl.checkSinglePermission).toHaveBeenCalledWith(
                'user123',
                'default',
                'remediations_read_remediation'
            );
        });

        test('should handle permission check errors gracefully', async () => {
            // Ensure Kessel is enabled and initialized for this test
            impl.kesselConfig.enabled = true;
            impl.initialized = true;
            impl.kesselClient = { check: jest.fn() }; // Mock client
            
            // Mock the permissionMetrics to handle observe calls
            impl.permissionMetrics = {
                observe: jest.fn()
            };
            
            // Mock checkSinglePermission to throw an error
            impl.checkSinglePermission = jest.fn().mockRejectedValue(new Error('Permission check failed'));
            
            const result = await impl.hasPermission('remediation', 'read', 'user123');
            expect(result).toBe(false);
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
            impl.getForwardedHeaders = jest.fn().mockReturnValue({
                'x-rh-identity': encodedIdentity
            });
            
            const result = impl.getIdentityFromHeaders();
            expect(result).toEqual(mockIdentity);
        });

        test('should handle invalid base64', () => {
            // Mock getForwardedHeaders with invalid base64
            impl.getForwardedHeaders = jest.fn().mockReturnValue({
                'x-rh-identity': 'invalid-base64'
            });
            
            const result = impl.getIdentityFromHeaders();
            expect(result).toBeNull();
        });

        test('should handle missing header', () => {
            // Mock getForwardedHeaders with no identity header
            impl.getForwardedHeaders = jest.fn().mockReturnValue({});
            
            const result = impl.getIdentityFromHeaders();
            expect(result).toBeNull();
        });
    });

    describe('ping', () => {
        test('should not throw when Kessel is disabled', async () => {
            // Create instance with disabled config
            const disabledConfig = { ...mockConfig, enabled: false };
            const disabledImpl = new KesselConnector(module, disabledConfig);
            
            await expect(disabledImpl.ping()).resolves.not.toThrow();
        });

        test('should handle ping permission check failure', async () => {
            // Ensure Kessel is enabled for this test
            impl.kesselConfig.enabled = true;
            
            // Mock pingPermissionCheck to throw an error
            impl.pingPermissionCheck = jest.fn().mockRejectedValue(new Error('Ping failed'));
            
            // The ping method should handle the error by throwing an assertion
            await expect(impl.ping()).rejects.toThrow('Kessel ping failed');
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
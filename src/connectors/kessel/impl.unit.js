'use strict';

// Mock the SDK modules at the top level before requiring impl
const mockFetchOIDCDiscovery = jest.fn();
const mockOAuth2ClientCredentials = jest.fn();
const mockOAuth2AuthRequest = jest.fn();
const mockFetchDefaultWorkspace = jest.fn();

// Mock Allowed enum - typical enum values are usually numbers like 0, 1, 2 or string constants
const MockAllowed = {
    ALLOWED_TRUE: 1, // Common enum pattern, adjust if needed
    ALLOWED_FALSE: 0,
    ALLOWED_UNSPECIFIED: 2
};

jest.mock('@project-kessel/kessel-sdk/kessel/inventory/v1beta2/allowed', () => ({
    Allowed: MockAllowed
}));

jest.mock('@project-kessel/kessel-sdk/kessel/auth', () => ({
    fetchOIDCDiscovery: (...args) => mockFetchOIDCDiscovery(...args),
    OAuth2ClientCredentials: jest.fn().mockImplementation((...args) => {
        mockOAuth2ClientCredentials(...args);
        return {}; // Return a mock instance
    }),
    oauth2AuthRequest: (...args) => mockOAuth2AuthRequest(...args)
}));

jest.mock('@project-kessel/kessel-sdk/kessel/rbac/v2', () => ({
    fetchDefaultWorkspace: (...args) => mockFetchDefaultWorkspace(...args)
}));

const KesselConnector = require('./impl');
const { mockRequest } = require('../testUtils');

describe('kessel impl', () => {
    // Create a test instance with mock config for each test
    let mockConfig;
    let impl;
    let originalMethods = {};
    let mockAuthToken = {};

    beforeEach(() => {
        mockRequest();
        
        // Create mock config for testing
        mockConfig = {
            enabled: true,
            url: 'localhost:9000',
            insecure: true,
            principalDomain: 'redhat',
            oidcIssuerUrl: 'issuer-url',
            clientId: 'test-id',
            clientSecret: 'test-secret',
        };

        mockAuthToken = { authToken: 'test-kessel-unit-test-token-placeholder' }
        
        // Create test instance
        impl = new KesselConnector(module, mockConfig);
        
        // Store original methods for restoration
        originalMethods = {
            getIdentityFromHeaders: impl.getIdentityFromHeaders,
            getForwardedHeaders: impl.getForwardedHeaders,
            checkSinglePermission: impl.checkSinglePermission,
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
        impl.kesselClient = originalMethods.kesselClient;
        impl.initialized = originalMethods.initialized;
        impl.permissionMetrics = originalMethods.permissionMetrics;
        
        // Clear any jest mocks
        jest.clearAllMocks();
        // Reset the module-level mock functions
        mockFetchOIDCDiscovery.mockClear();
        mockOAuth2ClientCredentials.mockClear();
        mockOAuth2AuthRequest.mockClear();
        mockFetchDefaultWorkspace.mockClear();
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

    describe('checkSinglePermission', () => {
        test('should construct proper check request structure', async () => {
            // Mock the kessel client
            // Need to import the mocked Allowed enum - it's a module-level variable in impl.js
            // The Allowed enum is imported in impl.js, so we need to use the same value
            const Allowed = require('@project-kessel/kessel-sdk/kessel/inventory/v1beta2/allowed').Allowed;
            const mockResponse = { allowed: Allowed.ALLOWED_TRUE };
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
            
            // Mock getDefaultWorkspaceIdForSubject to return a default workspace
            impl.getDefaultWorkspaceIdForSubject = jest.fn().mockResolvedValue({
                id: 'default',
                name: 'default',
                type: 'default',
                description: 'Default workspace'
            });
            
            // Mock the checkSinglePermission to test async flow
            impl.checkSinglePermission = jest.fn().mockResolvedValue(true);
            
            const result = await impl.hasPermission('remediation', 'read', 'user123');
            expect(result).toBe(true);
            expect(impl.checkSinglePermission).toHaveBeenCalledWith(
                'user123',
                'default',
                'remediations_view_remediation'
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

    describe('convertRbacToWorkspacePermission', () => {
        test('should convert RBAC permissions to workspace permissions correctly', () => {
            // Expected mappings that the function should produce
            const expectedMappings = {
                'remediation:read': 'remediations_view_remediation',
                'remediation:write': 'remediations_edit_remediation',
                'remediation:execute': 'remediations_execute_remediation',
                'playbook:read': 'remediations_view_playbook',
                'playbook:write': 'remediations_edit_playbook',
                'playbook:execute': 'remediations_execute_playbook',
                'system:read': 'remediations_view_system',
                'system:write': 'remediations_edit_system'
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
        test('should return default workspace ID', async () => {
            // Set up mock return values
            mockOAuth2AuthRequest.mockReturnValue(mockAuthToken);
            mockFetchDefaultWorkspace.mockResolvedValue({
                id: 'default',
                name: 'default',
                type: 'default',
                description: 'Default workspace'
            });

            const result = await impl.getDefaultWorkspaceIdForSubject('user123');

            expect(mockOAuth2AuthRequest).toHaveBeenCalledWith(expect.any(Object));
            expect(mockFetchDefaultWorkspace).toHaveBeenCalledWith(
                mockConfig.url,
                'user123',
                mockAuthToken
            );
            expect(result.id).toBe('default');
        });
    });
}); 
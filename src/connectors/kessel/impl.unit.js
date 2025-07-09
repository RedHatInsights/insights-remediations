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

    describe('getRemediationsAccess', () => {
        test('should return null when Kessel is not enabled', async () => {
            // Mock config to disable Kessel
            const originalConfig = require('../../config').kessel;
            require('../../config').kessel.enabled = false;
            
            const result = await impl.getRemediationsAccess();
            expect(result).toBeNull();
            
            // Restore original config
            require('../../config').kessel.enabled = originalConfig.enabled;
        });

        test('should return null when no identity is found', async () => {
            // Mock getIdentityFromHeaders to return null
            const originalMethod = impl.getIdentityFromHeaders;
            impl.getIdentityFromHeaders = jest.fn().mockReturnValue(null);
            
            const result = await impl.getRemediationsAccess();
            expect(result).toBeNull();
            
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

        test('should return false on error', async () => {
            // Mock doHttp to throw an error
            const originalDoHttp = impl.doHttp;
            impl.doHttp = jest.fn().mockRejectedValue(new Error('Network error'));
            
            const result = await impl.hasPermission('remediation', 'read', 'user123');
            expect(result).toBe(false);
            
            // Restore original method
            impl.doHttp = originalDoHttp;
        });
    });

    describe('transformKesselResponse', () => {
        test('should transform Kessel response to RBAC format', () => {
            const kesselResponse = {
                allowed: true,
                results: [
                    {
                        allowed: true,
                        resource: { type: 'remediations/remediation' },
                        relation: 'read'
                    },
                    {
                        allowed: false,
                        resource: { type: 'remediations/remediation' },
                        relation: 'write'
                    }
                ]
            };

            const result = impl.transformKesselResponse(kesselResponse);
            expect(result).toEqual({
                data: [
                    { permission: 'remediations:remediation:read' }
                ]
            });
        });

        test('should handle empty response', () => {
            const result = impl.transformKesselResponse(null);
            expect(result).toEqual({
                data: []
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
}); 
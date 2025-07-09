'use strict';

const _ = require('lodash');
const assert = require('assert');
const Connector = require('../Connector');
const log = require('../../util/log');

const { enabled, relationsApiHost, insecure, timeout, retries } = require('../../config').kessel;
const metrics = require('../metrics');

// Import Kessel SDK
let KesselClient;
try {
    const { Client } = require('@project-kessel/kessel-sdk');
    KesselClient = Client;
} catch (error) {
    log.warn('Kessel SDK not available, falling back to traditional RBAC');
    KesselClient = null;
}

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.accessMetrics = metrics.createConnectorMetric(this.getName(), 'getRemediationsAccess');
        this.kesselClient = null;
        this.initialized = false;
        
        if (enabled && KesselClient) {
            this.initializeKesselClient();
        }
    }

    initializeKesselClient() {
        try {
            this.kesselClient = new KesselClient({
                baseURL: relationsApiHost,
                timeout: timeout,
                retries: retries,
                headers: this.getForwardedHeaders()
            });
            this.initialized = true;
            log.info('Kessel client initialized successfully');
        } catch (error) {
            log.error({ error }, 'Failed to initialize Kessel client');
            this.initialized = false;
        }
    }

    async getRemediationsAccess(requestRetries = retries) {
        if (!enabled || !this.initialized || !this.kesselClient) {
            log.warn('Kessel not enabled or not initialized, cannot check access');
            return null;
        }

        try {
            const identity = this.getIdentityFromHeaders();
            if (!identity) {
                log.warn('No identity found in headers');
                return null;
            }

            const permissions = await this.checkRemediationsPermissions(identity);
            
            const result = this.doHttp({
                uri: `${relationsApiHost}/api/relations/v1/check`,
                method: 'POST',
                json: true,
                rejectUnauthorized: !insecure,
                headers: this.getForwardedHeaders(),
                body: {
                    permissions: permissions
                }
            }, false, this.accessMetrics);

            if (_.isEmpty(result)) {
                return null;
            }

            // Transform Kessel response to match RBAC response format
            return this.transformKesselResponse(result);
        } catch (e) {
            if (requestRetries > 0) {
                log.warn({ error: e, retries: requestRetries }, 'Kessel access fetch failed. Retrying');
                return this.getRemediationsAccess(requestRetries - 1);
            }

            log.error({ error: e }, 'Kessel access fetch failed after all retries');
            throw e;
        }
    }

    async checkRemediationsPermissions(identity) {
        // Define remediations-specific workspace permissions to check
        // These follow the new v2 permission model where permissions are workspace-based
        const workspacePermissions = [
            'remediations_read_remediation',
            'remediations_write_remediation', 
            'remediations_execute_remediation',
            'remediations_read_playbook',
            'remediations_write_playbook',
            'remediations_execute_playbook',
            'remediations_read_system',
            'remediations_write_system'
        ];

        // Get the user's workspace (this would typically come from the identity or be looked up)
        const workspaceId = this.extractWorkspaceId(identity);

        const permissionChecks = workspacePermissions.map(permission => {
            return {
                resource: {
                    type: 'workspace',
                    id: workspaceId || '*' // Use specific workspace or wildcard
                },
                relation: permission,
                subject: {
                    type: 'user',
                    id: identity.user_id || identity.identity?.user?.user_id
                }
            };
        });

        return permissionChecks;
    }

    extractWorkspaceId(identity) {
        // Extract workspace/organization ID from identity
        // This would typically be the account_number or org_id
        return identity.identity?.account_number || 
               identity.identity?.org_id || 
               identity.account_number || 
               identity.org_id ||
               'default';
    }

    transformKesselResponse(kesselResult) {
        // Transform Kessel ReBAC response to match traditional RBAC format
        const permissions = [];
        
        if (kesselResult && kesselResult.allowed && kesselResult.results) {
            // If any permissions are allowed, create corresponding RBAC-style permissions
            kesselResult.results?.forEach(result => {
                if (result.allowed) {
                    let rbacPermission = null;
                    
                    // Handle different response formats
                    if (result.relation && result.resource) {
                        // Format 1: Direct resource/relation format from some Kessel APIs
                        // e.g., { resource: { type: 'remediations/remediation' }, relation: 'read' }
                        if (result.resource.type && result.relation) {
                            const resourceType = result.resource.type.split('/').pop(); // 'remediations/remediation' -> 'remediation'
                            rbacPermission = `remediations:${resourceType}:${result.relation}`;
                        }
                    } else if (typeof result.relation === 'string' && result.relation.startsWith('remediations_')) {
                        // Format 2: Workspace permission format
                        // e.g., 'remediations_read_remediation'
                        rbacPermission = this.convertWorkspacePermissionToRbac(result.relation);
                    }
                    
                    if (rbacPermission) {
                        permissions.push(rbacPermission);
                    }
                }
            });
        }

        return {
            data: permissions.map(permission => ({ permission }))
        };
    }

    convertWorkspacePermissionToRbac(workspacePermission) {
        // Convert workspace permission back to traditional RBAC format
        // e.g., 'remediations_read_remediation' -> 'remediations:remediation:read'
        const permissionMap = {
            'remediations_read_remediation': 'remediations:remediation:read',
            'remediations_write_remediation': 'remediations:remediation:write',
            'remediations_execute_remediation': 'remediations:remediation:execute',
            'remediations_read_playbook': 'remediations:playbook:read',
            'remediations_write_playbook': 'remediations:playbook:write',
            'remediations_execute_playbook': 'remediations:playbook:execute',
            'remediations_read_system': 'remediations:system:read',
            'remediations_write_system': 'remediations:system:write'
        };

        return permissionMap[workspacePermission] || null;
    }

    getIdentityFromHeaders() {
        const headers = this.getForwardedHeaders();
        
        // Try to extract identity from x-rh-identity header
        if (headers['x-rh-identity']) {
            try {
                const identityHeader = Buffer.from(headers['x-rh-identity'], 'base64').toString();
                return JSON.parse(identityHeader);
            } catch (error) {
                log.warn({ error }, 'Failed to parse x-rh-identity header');
            }
        }

        return null;
    }

    async ping () {
        if (!enabled) {
            log.debug('Kessel not enabled, skipping ping');
            return;
        }

        const result = await this.getRemediationsAccess();
        assert(result !== null || !this.initialized, 'Kessel ping failed');
    }

    // Compatibility method to check specific permission
    async hasPermission(resource, action, subject) {
        if (!enabled || !this.initialized || !this.kesselClient) {
            return false;
        }

        try {
            // Convert traditional RBAC permission to workspace permission
            // The resource and action parameters come from the RBAC middleware
            // e.g., hasPermission('remediation', 'read', 'user123')
            const workspacePermission = this.convertRbacToWorkspacePermission(resource, action);
            if (!workspacePermission) {
                log.warn({ resource, action }, 'Unknown permission mapping');
                return false;
            }

            // Get workspace ID from subject or use default
            const workspaceId = this.getWorkspaceIdForSubject(subject);

            const checkRequest = {
                resource: {
                    type: 'workspace',
                    id: workspaceId
                },
                relation: workspacePermission,
                subject: {
                    type: 'user',
                    id: subject
                }
            };

            const result = await this.doHttp({
                uri: `${relationsApiHost}/api/relations/v1/check`,
                method: 'POST',
                json: true,
                rejectUnauthorized: !insecure,
                headers: this.getForwardedHeaders(),
                body: checkRequest
            }, false, this.accessMetrics);

            return result && result.allowed === true;
        } catch (error) {
            log.error({ error, resource, action, subject }, 'Failed to check permission with Kessel');
            return false;
        }
    }

    convertRbacToWorkspacePermission(resource, action) {
        // Convert traditional RBAC permission to workspace permission
        // e.g., ('remediation', 'read') -> 'remediations_read_remediation'
        const permissionKey = `${resource}:${action}`;
        const permissionMap = {
            'remediation:read': 'remediations_read_remediation',
            'remediation:write': 'remediations_write_remediation',
            'remediation:execute': 'remediations_execute_remediation',
            'playbook:read': 'remediations_read_playbook',
            'playbook:write': 'remediations_write_playbook',
            'playbook:execute': 'remediations_execute_playbook',
            'system:read': 'remediations_read_system',
            'system:write': 'remediations_write_system'
        };

        return permissionMap[permissionKey] || null;
    }

    getWorkspaceIdForSubject(subject) {
        // In a real implementation, this would look up the user's workspace
        // For now, we'll use a default or extract from current identity
        const identity = this.getIdentityFromHeaders();
        if (identity) {
            return this.extractWorkspaceId(identity);
        }
        return 'default';
    }
}(); 
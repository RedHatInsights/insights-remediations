'use strict';

const assert = require('assert');
const Connector = require('../Connector');
const log = require('../../util/log');

const { enabled, url, insecure } = require('../../config').kessel;
const metrics = require('../metrics');

// Import Kessel SDK components
let KesselInventoryServiceClient, ChannelCredentials;
try {
    // Import all required Kessel SDK components
    const kesselInventory = require('@project-kessel/kessel-sdk/kessel/inventory/v1beta2/inventory_service');
    KesselInventoryServiceClient = kesselInventory.KesselInventoryServiceClient;

    // Import gRPC credentials
    const grpcJs = require('@grpc/grpc-js');
    ChannelCredentials = grpcJs.ChannelCredentials;

} catch (error) {
    log.warn('Kessel SDK not available, falling back to traditional RBAC:', error.message);
    KesselInventoryServiceClient = null;
}

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.kesselClient = null;
        this.initialized = false;
        this.permissionMetrics = metrics.createConnectorMetric(this.getName(), 'Kessel.getRemediationsAccess');

        if (enabled && KesselInventoryServiceClient) {
            this.initializeKesselClient();
        }
    }

    initializeKesselClient() {
        try {
            // Create gRPC credentials
            const credentials = insecure
                ? ChannelCredentials.createInsecure()
                : ChannelCredentials.createSsl();

            // Initialize the gRPC client using the URL directly
            this.kesselClient = new KesselInventoryServiceClient(
                url,
                credentials,
                {
                    // Channel options
                    'grpc.keepalive_time_ms': 30000,
                    'grpc.keepalive_timeout_ms': 5000,
                    'grpc.keepalive_permit_without_calls': true,
                    'grpc.http2.max_pings_without_data': 0,
                    'grpc.http2.min_time_between_pings_ms': 10000,
                    'grpc.http2.min_ping_interval_without_data_ms': 300000
                }
            );
            this.initialized = true;
            log.info('Kessel gRPC client initialized successfully');
        } catch (error) {
            log.error({ error }, 'Failed to initialize Kessel gRPC client');
            this.initialized = false;
        }
    }

    async pingPermissionCheck() {
        if (!enabled || !this.initialized || !this.kesselClient) {
            log.warn('Kessel not enabled or not initialized, cannot check access');
            return false;
        }

        try {
            const identity = this.getIdentityFromHeaders();
            if (!identity) {
                log.warn('No identity found in headers for ping check');
                return false;
            }

            const userId = identity.user_id || identity.identity?.user?.user_id;
            const workspaceId = this.extractWorkspaceId(identity);

            // Just check a single basic permission for ping
            return await this.checkSinglePermission(userId, workspaceId, 'remediations_read_remediation');
        } catch (error) {
            log.warn({ error }, 'Kessel ping permission check failed');
            return false;
        }
    }

    async checkSinglePermission(userId, workspaceId, relation) {
        return new Promise((resolve, reject) => {
            // Create subject reference
            const subjectReference = {
                resource: {
                    reporter: {
                        type: "rbac"
                    },
                    resourceId: `redhat/${userId}`,
                    resourceType: "principal"
                }
            };

            // Create resource reference
            const resource = {
                reporter: {
                    type: "rbac"
                },
                resourceId: workspaceId,
                resourceType: "workspace"
            };

            // Create check request
            const checkRequest = {
                object: resource,
                relation: relation,
                subject: subjectReference
            };

            // Make the gRPC call
            this.kesselClient.check(checkRequest, (error, response) => {
                if (!error && response) {
                    resolve(response.allowed || false);
                } else {
                    log.warn({ error, checkRequest }, 'gRPC check call failed');
                    reject(error || new Error('No response received'));
                }
            });
        });
    }

    extractWorkspaceId(identity) {
        // Extract workspace/organization ID from identity
        return identity.identity?.account_number ||
               identity.identity?.org_id ||
               identity.account_number ||
               identity.org_id ||
               'default';
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

        try {
            await this.pingPermissionCheck();
        } catch (error) {
            log.warn({ error }, 'Kessel ping check failed');
            assert(false, 'Kessel ping failed');
        }
    }

    // Compatibility method to check specific permission
    async hasPermission(resource, action, subject) {
        if (!enabled || !this.initialized || !this.kesselClient) {
            return false;
        }

        const startTime = Date.now();
        try {
            // Convert traditional RBAC permission to workspace permission
            const workspacePermission = this.convertRbacToWorkspacePermission(resource, action);
            if (!workspacePermission) {
                log.warn({ resource, action }, 'Unknown permission mapping');
                return false;
            }

            // Get workspace ID from subject or use default
            const workspaceId = this.getDefaultWorkspaceIdForSubject(subject);

            // Check the specific permission
            const allowed = await this.checkSinglePermission(subject, workspaceId, workspacePermission);

            // Record successful metric
            this.permissionMetrics.observe(Date.now() - startTime, 200);

            return allowed;
        } catch (error) {
            // Record error metric
            this.permissionMetrics.observe(Date.now() - startTime, 500);

            log.error({ error, resource, action, subject }, 'Failed to check permission with Kessel');
            return false;
        }
    }

    convertRbacToWorkspacePermission(resource, action) {
        // Convert traditional RBAC permission to workspace permission
        // Pattern: ${resource}:${action} -> remediations_${action}_${resource}
        return `remediations_${action}_${resource}`;
    }

    getDefaultWorkspaceIdForSubject(subject) {
        // For now, return a default workspace ID
        // In a real implementation, this would look up the user's default workspace based on the subject
        return 'default';
    }
}();

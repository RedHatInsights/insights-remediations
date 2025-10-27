'use strict';

const assert = require('assert');
const Connector = require('../Connector');
const log = require('../../util/log');

const metrics = require('../metrics');

// Import new Kessel SDK with ClientBuilder
let ClientBuilder, PromisifiedClient, KesselInventoryServiceClient,
    fetchOIDCDiscovery, OAuth2ClientCredentials, ResourceReference,
    SubjectReference, CheckRequest
try {
    // Import the new ClientBuilder from the updated SDK
    const kesselSdk = require('@project-kessel/kessel-sdk/kessel/inventory/v1beta2');
    ClientBuilder = kesselSdk.ClientBuilder;

    const promisifySdk = require('@project-kessel/kessel-sdk/promisify');
    PromisifiedClient = promisifySdk.PromisifiedClient;

    const inventorySdk = require('@project-kessel/kessel-sdk/kessel/inventory/v1beta2/inventory_service');
    KesselInventoryServiceClient = inventorySdk.KesselInventoryServiceClient;

    const oAuthSdk = require('@project-kessel/kessel-sdk/kessel/auth');
    fetchOIDCDiscovery = oAuthSdk.fetchOIDCDiscovery;
    OAuth2ClientCredentials = oAuthSdk.OAuth2ClientCredentials;
} catch (error) {
    log.warn('Kessel SDK not available, falling back to traditional RBAC:', error.message);
    ClientBuilder = null;
}


module.exports = class extends Connector {
    constructor (module, kesselConfig) {
        super(module);
        this.kesselConfig = kesselConfig;
        this.kesselClient = null;
        this.initialized = false;
        this.permissionMetrics = metrics.createConnectorMetric(this.getName(), 'Kessel.getRemediationsAccess');

        if (this.kesselConfig.enabled && ClientBuilder) {
            this.initializeKesselClient();
        }
    }

    async initializeKesselClient() {

        try {
            // Use the new ClientBuilder pattern
            const builder = new ClientBuilder(this.kesselConfig.url);

            // Configure credentials based on the insecure flag
            if (this.kesselConfig.insecure) {
                builder.insecure();

            // Configure credentials based on the auth enabled flag
            } else if (this.kesselConfig.authEnabled) {
                const discovery = await fetchOIDCDiscovery(
                    this.kesselConfig.oidcIssuerUrl,
                );

                const oAuth2ClientCredentials = new OAuth2ClientCredentials({
                    clientId: this.kesselConfig.clientId,
                    clientSecret: this.kesselConfig.clientSecret,
                    tokenEndpoint: discovery.tokenEndpoint,
                });

                builder.oauth2ClientAuthenticated(oAuth2ClientCredentials);
            } else {
                builder.unauthenticated();
            }

            // Build the Client
            this.kesselClient = builder.buildAsync();
            this.initialized = true
            log.info('Kessel client initialized successfully using ClientBuilder');

            return this.kesselClient
        } catch (error) {
            log.error({ error }, 'Failed to initialize Kessel client');
            this.initialized = false;
        }
    }



    async pingPermissionCheck() {
        if (!this.kesselConfig.enabled || !this.initialized || !this.kesselClient) {
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
        try {
            // Create the check request using the new API structure
            const checkRequest = {
                subject: {
                    resource: {
                        reporter: {
                            type: "rbac"
                        },
                        resourceId: `${this.kesselConfig.principal}/${userId}`,
                        resourceType: "principal"
                    }
                },
                object: {
                    reporter: {
                        type: "rbac"
                    },
                    resourceId: workspaceId,
                    resourceType: "workspace"
                },
                relation: relation
            };

            // Use async/await with the new client
            const response = await this.kesselClient.check(checkRequest);
            return response.allowed || false;
        } catch (error) {
            log.warn({ error, userId, workspaceId, relation }, 'Kessel check call failed');
            throw error;
        }
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
        if (!this.kesselConfig.enabled) {
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
        if (!this.kesselConfig.enabled || !this.initialized || !this.kesselClient) {
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

            // Check the specific permission using async/await
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
};
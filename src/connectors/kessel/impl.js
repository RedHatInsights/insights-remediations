'use strict';

const assert = require('assert');
const Connector = require('../Connector');
const log = require('../../util/log');

const metrics = require('../metrics');

// Import new Kessel SDK with ClientBuilder
let ClientBuilder, fetchOIDCDiscovery, OAuth2ClientCredentials, OAuth2AuthRequest, fetchDefaultWorkspace, Allowed
try {
    // Import the new ClientBuilder from the updated SDK
    const kesselSdk = require('@project-kessel/kessel-sdk/kessel/inventory/v1beta2');
    ClientBuilder = kesselSdk.ClientBuilder;
    
    const allowedSdk = require('@project-kessel/kessel-sdk/kessel/inventory/v1beta2/allowed');
    Allowed = allowedSdk.Allowed;

    const oAuthSdk = require('@project-kessel/kessel-sdk/kessel/auth');
    fetchOIDCDiscovery = oAuthSdk.fetchOIDCDiscovery;
    OAuth2ClientCredentials = oAuthSdk.OAuth2ClientCredentials;
    OAuth2AuthRequest = oAuthSdk.oauth2AuthRequest;

    const rbacSdk = require('@project-kessel/kessel-sdk/kessel/rbac/v2');
    fetchDefaultWorkspace = rbacSdk.fetchDefaultWorkspace;
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

    async checkSinglePermission(userId, workspaceId, relation) {
        try {
            // Create the check request using the new API structure
            const checkRequest = {
                subject: {
                    resource: {
                        reporter: {
                            type: "rbac"
                        },
                        resourceId: `${this.kesselConfig.principalDomain}/${userId}`,
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
            return response.allowed === Allowed.ALLOWED_TRUE;
        } catch (error) {
            log.warn({ error, userId, workspaceId, relation }, 'Kessel check call failed');
            throw error;
        }
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

    // Compatibility method to check specific permission
    async hasPermission(resource, action, subject_org_id) {
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

            // Get workspace ID from subject_org_id or use default
            const workspace = await this.getDefaultWorkspaceIdForSubject(subject_org_id);
            const workspaceId = workspace?.id || null;

            // Check the specific permission using async/await
            const allowed = await this.checkSinglePermission(subject_org_id, workspaceId, workspacePermission);

            // Record successful metric
            this.permissionMetrics.observe(Date.now() - startTime, 200);

            return allowed;
        } catch (error) {
            // Record error metric
            this.permissionMetrics.observe(Date.now() - startTime, 500);

            log.error({ error, resource, action, subject_org_id }, 'Failed to check permission with Kessel');
            return false;
        }
    }

    convertRbacToWorkspacePermission(resource, action) {
        // Convert traditional RBAC permission to workspace permission
        // Pattern: ${resource}:${action} -> remediations_${action}_${resource}
        const actions = {
            read : 'view',
            write : 'edit'
        };
        action = action in actions ? actions[action] : action;
        return `remediations_${action}_${resource}`;
    }

    async getDefaultWorkspaceIdForSubject(subject_org_id) {
        try {
            const discovery = await fetchOIDCDiscovery(
                this.kesselConfig.oidcIssuerUrl,
            );
            const oAuth2ClientCredentials = new OAuth2ClientCredentials({
                clientId: this.kesselConfig.clientId,
                clientSecret: this.kesselConfig.clientSecret,
                tokenEndpoint: discovery.tokenEndpoint,
            });
            const defaultWorkspace = await fetchDefaultWorkspace(
                                    this.kesselConfig.url,
                                    subject_org_id,
                                    OAuth2AuthRequest(oAuth2ClientCredentials),
                                );
            return defaultWorkspace;
        } catch (e) {
            log.error(`Error received when fetching workspace`, e);
            return null;
        }
    }
};
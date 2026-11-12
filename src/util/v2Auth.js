'use strict';

const log = require('./log');
const config = require('../config');

let OAuth2ClientCredentials;
let fetchOIDCDiscovery;
try {
    ({OAuth2ClientCredentials, fetchOIDCDiscovery} = require('@project-kessel/kessel-sdk/kessel/auth'));
} catch (e) {
    log.warn('Kessel SDK auth not available for V2 bearer tokens:', e.message);
}

let credentialsPromise = null;

async function initCredentials () {
    if (!OAuth2ClientCredentials || !fetchOIDCDiscovery) {
        throw new Error('Kessel SDK not available for V2 bearer auth');
    }

    const discovery = await fetchOIDCDiscovery(config.kessel.oidcIssuerUrl);
    return new OAuth2ClientCredentials({
        clientId: config.kessel.clientId,
        clientSecret: config.kessel.clientSecret,
        tokenEndpoint: discovery.tokenEndpoint
    });
}

function getCredentials () {
    if (!credentialsPromise) {
        credentialsPromise = initCredentials();
    }

    return credentialsPromise;
}

/**
 * Obtain a bearer access token via the Kessel SDK OAuth2 client credentials grant.
 * Lazy-initializes OIDC discovery and credential caching on first call.
 * @returns {Promise<string>} The access token string.
 */
async function getV2BearerToken () {
    const credentials = await getCredentials();
    const token = await credentials.getToken();
    return token.accessToken;
}

/**
 * Add V2 CA certificate to request options for defense-in-depth.
 */
function applyV2CaCert (options, certBuffer) {
    if (certBuffer) {
        options.agentOptions = {
            ...(options.agentOptions || {}),
            ca: certBuffer
        };
    }

    return options;
}

module.exports = { getV2BearerToken, applyV2CaCert };

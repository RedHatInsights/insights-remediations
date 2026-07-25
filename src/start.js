'use strict';

// Replaces: NODE_EXTRA_CA_CERTS=$(jq -r .tlsCAPath $ACG_CONFIG /dev/null)
// Hummingbird runtime images do not ship jq.
const fs = require('fs');

const acgConfigPath = process.env.ACG_CONFIG;
if (acgConfigPath) {
    try {
        const acg = JSON.parse(fs.readFileSync(acgConfigPath, 'utf8'));
        if (acg.tlsCAPath) {
            process.env.NODE_EXTRA_CA_CERTS = acg.tlsCAPath;
        }
    } catch (err) {
        // Match jq + /dev/null behavior: missing/invalid config does not block startup
    }
}

require('./app');

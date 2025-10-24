#!/usr/bin/env node

'use strict';

/**
 * Test script for Kessel migration
 *
 * This script helps test both traditional RBAC and Kessel authorization
 * to ensure the migration works correctly.
 */

const config = require('../src/config');
const rbacConnector = require('../src/connectors/rbac');
const kesselConnector = require('../src/connectors/kessel');

async function testTraditionalRbac() {
    console.log('\n=== Testing Traditional RBAC ===');

    try {
        console.log('RBAC Config:', {
            impl: config.rbac.impl,
            host: config.rbac.host,
            enforce: config.rbac.enforce
        });

        if (config.rbac.enforce) {
            console.log('Attempting to get RBAC access...');
            const access = await rbacConnector.getRemediationsAccess();

            if (access && access.data) {
                console.log(`✓ RBAC Access retrieved: ${access.data.length} permissions found`);
                access.data.forEach((perm, index) => {
                    console.log(`  ${index + 1}. ${perm.permission}`);
                });
            } else {
                console.log('⚠ RBAC Access returned null or empty');
            }

            console.log('Testing RBAC ping...');
            await rbacConnector.ping();
            console.log('✓ RBAC ping successful');
        } else {
            console.log('⚠ RBAC enforcement is disabled');
        }
    } catch (error) {
        console.error('✗ Traditional RBAC test failed:', error.message);
    }
}

async function testKessel() {
    console.log('\n=== Testing Kessel ===');

    try {
        console.log('Kessel Config:', {
            enabled: config.kessel.enabled,
            url: config.kessel.url,
            insecure: config.kessel.insecure,
            timeout: config.kessel.timeout
        });

        if (config.kessel.enabled) {
            console.log('Attempting to get Kessel access...');
            const access = await kesselConnector.getRemediationsAccess();

            if (access && access.data) {
                console.log(`✓ Kessel Access retrieved: ${access.data.length} permissions found`);
                access.data.forEach((perm, index) => {
                    console.log(`  ${index + 1}. ${perm.permission}`);
                });
            } else {
                console.log('⚠ Kessel Access returned null or empty');
            }

            console.log('Testing specific permission check...');
            const hasPermission = await kesselConnector.hasPermission(
                'remediation',
                'read',
                'test-user-123'
            );
            console.log(`✓ Permission check result (workspace-based): ${hasPermission}`);

            console.log('Testing workspace permission mapping...');
            const workspacePermission = kesselConnector.convertRbacToWorkspacePermission('remediation', 'read');
            console.log(`✓ Workspace permission mapping: remediation:read → ${workspacePermission}`);

            console.log('Testing Kessel ping...');
            await kesselConnector.ping();
            console.log('✓ Kessel ping successful');
        } else {
            console.log('⚠ Kessel is disabled');
        }
    } catch (error) {
        console.error('✗ Kessel test failed:', error.message);
    }
}

async function testRbacMiddleware() {
    console.log('\n=== Testing RBAC Middleware Logic ===');

    // Mock request object
    const mockReq = {
        identity: {
            type: 'User',
            identity: {
                user: {
                    user_id: 'test-user-123'
                }
            }
        },
        headers: {
            'x-rh-identity': Buffer.from(JSON.stringify({
                identity: {
                    user: {
                        user_id: 'test-user-123'
                    }
                }
            })).toString('base64')
        }
    };

    // Test different permission scenarios
    const permissions = [
        'remediations:remediation:read',
        'remediations:remediation:write',
        'remediations:playbook:execute',
        'remediations:system:read'
    ];

    for (const permission of permissions) {
        try {
            console.log(`\nTesting permission: ${permission}`);

            // Import and test the middleware
            const rbacMiddleware = require('../src/middleware/rbac');
            const middleware = rbacMiddleware(permission);

            let middlewareResult = 'unknown';
            const mockNext = (error) => {
                if (error) {
                    middlewareResult = `denied: ${error.message}`;
                } else {
                    middlewareResult = 'allowed';
                }
            };

            await middleware(mockReq, {}, mockNext);
            console.log(`  Result: ${middlewareResult}`);

        } catch (error) {
            console.error(`  ✗ Error testing ${permission}:`, error.message);
        }
    }
}

function printEnvironmentInfo() {
    console.log('=== Environment Information ===');
    console.log('Node.js Version:', process.version);
    console.log('Environment Variables:');
    console.log('  RBAC_ENFORCE:', process.env.RBAC_ENFORCE);
    console.log('  RBAC_HOST:', process.env.RBAC_HOST);
    console.log('  KESSEL_ENABLED:', process.env.KESSEL_ENABLED);
    console.log('  KESSEL_URL:', process.env.KESSEL_URL);
    console.log('  KESSEL_INSECURE:', process.env.KESSEL_INSECURE);
    console.log('  LOG_LEVEL:', process.env.LOG_LEVEL);
}

function printInstructions() {
    console.log('\n=== Migration Test Instructions ===');
    console.log('1. Traditional RBAC Test:');
    console.log('   - Ensure RBAC service is running');
    console.log('   - Set RBAC_ENFORCE=true');
    console.log('   - Set appropriate RBAC_HOST');

    console.log('\n2. Kessel Test:');
    console.log('   - Start Kessel services: docker-compose -f docker-compose.kessel.yml up -d');
    console.log('   - Set KESSEL_ENABLED=true');
    console.log('   - Set KESSEL_URL=http://localhost:8081');
    console.log('   - Set KESSEL_INSECURE=true (for local testing)');
    console.log('   - Note: Uses workspace-based permissions (v2 model)');

    console.log('\n3. Switch between modes by toggling KESSEL_ENABLED');
    console.log('4. Monitor logs for any errors or warnings');
    console.log('5. Test actual API endpoints after this script passes');
}

async function main() {
    console.log('🚀 Kessel Migration Test Script');
    console.log('=====================================');

    printEnvironmentInfo();

    // Test traditional RBAC
    await testTraditionalRbac();

    // Test Kessel
    await testKessel();

    // Test middleware logic
    await testRbacMiddleware();

    // Print instructions
    printInstructions();

    console.log('\n✅ Migration test script completed');
    console.log('\nNext steps:');
    console.log('1. Fix any failing tests');
    console.log('2. Test with actual HTTP requests');
    console.log('3. Monitor application logs during transition');
    console.log('4. Gradually roll out to production');
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
    process.exit(1);
});

// Run the test
if (require.main === module) {
    main().catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}

module.exports = {
    testTraditionalRbac,
    testKessel,
    testRbacMiddleware
};
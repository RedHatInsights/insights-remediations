#!/usr/bin/env node

// Test to verify the correct Kessel gRPC structure
// Keep this file as a reference for the correct format

console.log('=== Testing Kessel gRPC Structure ===\n');

// Mock the gRPC components to verify structure
class MockKesselInventoryServiceClient {
    constructor(address, credentials, options) {
        console.log('✓ KesselInventoryServiceClient initialized with:');
        console.log('  Address:', address);
        console.log('  Credentials type:', credentials.constructor.name);
        console.log('  Options:', Object.keys(options));
    }

    check(checkRequest, callback) {
        console.log('✓ check() method called with:');
        console.log('  Object:', checkRequest.object);
        console.log('  Relation:', checkRequest.relation);
        console.log('  Subject:', checkRequest.subject);

        // Simulate successful response
        setTimeout(() => {
            callback(null, { allowed: true });
        }, 100);
    }
}

class MockChannelCredentials {
    static createInsecure() {
        console.log('✓ ChannelCredentials.createInsecure() called');
        return new MockChannelCredentials();
    }

    static createSsl() {
        console.log('✓ ChannelCredentials.createSsl() called');
        return new MockChannelCredentials();
    }
}

// Test the structure matching the example from kessel-sdk-node
async function testKesselStructure() {
    console.log('1. Testing client initialization (matching the example):');

    const address = 'localhost:9081';
    const credentials = MockChannelCredentials.createInsecure();
    const options = {
        'grpc.keepalive_time_ms': 30000,
        'grpc.keepalive_timeout_ms': 5000,
        'grpc.keepalive_permit_without_calls': true,
        'grpc.http2.max_pings_without_data': 0,
        'grpc.http2.min_time_between_pings_ms': 10000,
        'grpc.http2.min_ping_interval_without_data_ms': 300000
    };

    const client = new MockKesselInventoryServiceClient(address, credentials, options);

    console.log('\n2. Testing check request structure (matching the example):');

    // This matches the structure from the kessel-sdk-node example
    const subjectReference = {
        resource: {
            reporter: {
                type: 'rbac'
            },
            resourceId: 'user123',  // This would be the actual user ID
            resourceType: 'principal'
        }
    };

    const resource = {
        reporter: {
            type: 'rbac'
        },
        resourceId: 'workspace123',  // This would be the actual workspace ID
        resourceType: 'workspace'
    };

    const checkRequest = {
        object: resource,
        relation: 'remediations_read_remediation',  // Kessel format permission
        subject: subjectReference
    };

    console.log('\n3. Testing gRPC call (matching the example callback pattern):');

    return new Promise((resolve) => {
        client.check(checkRequest, (error, response) => {
            if (!error) {
                console.log('✓ gRPC call successful');
                console.log('  Response:', response);
            } else {
                console.log('✗ gRPC call failed:', error);
            }

            resolve();
        });
    });
}

async function testPermissionConversion() {
    console.log('\n4. Testing permission conversion (RBAC ↔ Kessel):');

    // Test RBAC to Kessel conversion
    const rbacToKesselMap = {
        'remediation:read': 'remediations_read_remediation',
        'remediation:write': 'remediations_write_remediation',
        'remediation:execute': 'remediations_execute_remediation',
        'playbook:read': 'remediations_read_playbook',
        'playbook:write': 'remediations_write_playbook',
        'playbook:execute': 'remediations_execute_playbook',
        'system:read': 'remediations_read_system',
        'system:write': 'remediations_write_system'
    };

    console.log('RBAC to Kessel conversion:');
    Object.entries(rbacToKesselMap).forEach(([rbac, kessel]) => {
        console.log(`  ${rbac} -> ${kessel}`);
    });

    // Test Kessel to RBAC conversion
    const kesselToRbacMap = {
        remediations_read_remediation: 'remediations:remediation:read',
        remediations_write_remediation: 'remediations:remediation:write',
        remediations_execute_remediation: 'remediations:remediation:execute',
        remediations_read_playbook: 'remediations:playbook:read',
        remediations_write_playbook: 'remediations:playbook:write',
        remediations_execute_playbook: 'remediations:playbook:execute',
        remediations_read_system: 'remediations:system:read',
        remediations_write_system: 'remediations:system:write'
    };

    console.log('\nKessel to RBAC conversion:');
    Object.entries(kesselToRbacMap).forEach(([kessel, rbac]) => {
        console.log(`  ${kessel} -> ${rbac}`);
    });
}

function showExpectedStructure() {
    console.log('\n5. Expected structure reference:');
    console.log('');
    console.log('// From the kessel-sdk-node example:');
    console.log('const stub = new KesselInventoryServiceClient(');
    console.log('  "localhost:9081",');
    console.log('  ChannelCredentials.createInsecure(),');
    console.log('  { /* Channel options */ }');
    console.log(');');
    console.log('');
    console.log('const subjectReference = {');
    console.log('  resource: {');
    console.log('    reporter: { type: "rbac" },');
    console.log('    resourceId: "foobar",');
    console.log('    resourceType: "principal"');
    console.log('  }');
    console.log('};');
    console.log('');
    console.log('const resource = {');
    console.log('  reporter: { type: "rbac" },');
    console.log('  resourceId: "1234",');
    console.log('  resourceType: "workspace"');
    console.log('};');
    console.log('');
    console.log('const check_request = {');
    console.log('  object: resource,');
    console.log('  relation: "inventory_host_view",');
    console.log('  subject: subjectReference');
    console.log('};');
    console.log('');
    console.log('stub.check(check_request, (error, response) => {');
    console.log('  if (!error) {');
    console.log('    console.log("Check response:", response);');
    console.log('  } else {');
    console.log('    console.log("gRPC error:", error);');
    console.log('  }');
    console.log('});');
}

async function main() {
    await testKesselStructure();
    await testPermissionConversion();
    showExpectedStructure();
    console.log('\n=== Kessel gRPC Structure Test Complete! ===');
    console.log('This file serves as a reference for the correct Kessel SDK usage.');
}

main().catch(console.error);

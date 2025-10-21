'use strict';

exports.IDENTITY_HEADER = 'x-rh-identity';

const DEFAULTS = Object.freeze({
    account_number: 'test',
    type: 'User',
    user: {
        username: 'tuser@redhat.com',
        email: 'tuser@redhat.com',
        first_name: 'test',
        last_name: 'user',
        is_active: true,
        is_org_admin: false,
        is_internal: true,
        locale: 'en_US'
    },
    internal: {
        org_id: '0000000'
    }
});

exports.createIdentityHeader = function (
    username = DEFAULTS.user.username,
    account_number = DEFAULTS.account_number,
    org_id = DEFAULTS.internal.org_id,
    is_internal = true,
    transform = f => f) {

    const data = {
        entitlements: {
            insights: {
                is_entitled: true
            },
            openshift: {
                is_entitled: true
            },
            hybrid_cloud: {
                is_entitled: true
            }
        },
        identity: {
            account_number,
            org_id,
            type: DEFAULTS.type,
            user: {
                ...DEFAULTS.user,
                username,
                is_internal
            }
        }
    };

    return encode(transform(data));
};

exports.createCertIdentityHeader = function (account_number, tenant_org_id = '5318290', transform = f=>f) {
    const data = {
        entitlements: {
            insights: {
                is_entitled: true
            },
            openshift: {
                is_entitled: true
            },
            hybrid_cloud: {
                is_entitled: true
            }
        },
        identity: {
            internal: {
                auth_time: 5700,
                auth_type: 'cert-auth',
                org_id: tenant_org_id
            },
            account_number,
            org_id: tenant_org_id,
            system: {
                cn: '81390ad6-ce49-4c8f-aa64-729d374ee65c'
            },
            type: 'System'
        }
    };

    return encode(transform(data));
};

exports.createServiceAccountIdentityHeader = function (
    username = 'test-service-account',
    account_number = DEFAULTS.account_number,
    org_id = DEFAULTS.internal.org_id,
    transform = f => f) {

    const data = {
        entitlements: {
            insights: {
                is_entitled: true
            },
            openshift: {
                is_entitled: true
            },
            hybrid_cloud: {
                is_entitled: true
            }
        },
        identity: {
            account_number,
            org_id,
            type: 'ServiceAccount',
            service_account: {
                username,
                client_id: 'test-client-id',
                is_org_admin: false
            }
        }
    };

    return encode(transform(data));
};

function encode (data) {
    return Buffer.from(JSON.stringify(data)).toString('base64');
}

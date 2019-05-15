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
        org_id: '5318290' // not used by remediations but some apps (compliance) rely on this (demo mode)
    }
});

exports.createIdentityHeader = function (
    username = DEFAULTS.user.username,
    account_number = DEFAULTS.account_number,
    is_internal = true,
    transform = f => f) {

    const data = {
        identity: {
            account_number,
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

exports.createCertIdentityHeader = function (account_number, transform = f=>f) {
    const data = {
        entitlements: {
            insights: {
                is_entitled: true
            },
            openshift: {
                is_entitled: true
            },
            smart_management: {
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
                org_id: 5318290
            },
            account_number,
            system: {},
            type: 'System'
        }
    };

    return encode(transform(data));
};

function encode (data) {
    return Buffer.from(JSON.stringify(data)).toString('base64');
}

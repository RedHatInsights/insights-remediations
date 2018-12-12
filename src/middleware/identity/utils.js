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

function encode (data) {
    return Buffer.from(JSON.stringify(data)).toString('base64');
}

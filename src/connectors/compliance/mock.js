'use strict';

const P = require('bluebird');

/* eslint max-len: off */
const DATA = Object.freeze({
    'xccdf_org.ssgproject.content_rule_sshd_disable_root_login': {
        data: {
            id: 'dac6258c-ac47-47c1-8c78-9afb0e42b4f7',
            type: 'rule',
            attributes: {
                created_at: '2018-12-07T09:24:25.577Z',
                updated_at: '2018-12-07T09:24:25.577Z',
                ref_id: 'xccdf_org.ssgproject.content_rule_sshd_disable_root_login',
                title: 'Disable SSH Root Login',
                rationale: 'Even though the communications channel may be encrypted, an additional layer of\nsecurity is gained by extending the policy of not logging directly on as root.\nIn addition, logging in with a user-specific account provides individual\naccountability of actions performed on the system and also helps to minimize\ndirect attack attempts on root\'s password.',
                description: 'The root user should never be allowed to login to a\nsystem directly over a network.\nTo disable root login via SSH, add or correct the following line\nin /etc/ssh/sshd_config:\nPermitRootLogin no',
                severity: 'Medium',
                total_systems_count: 0,
                affected_systems_count: 0
            }
        }
    },
    'xccdf_org.ssgproject.content_rule_no_empty_passwords': {
        data: {
            id: 'b8ce9b13-dcdc-4356-8cbe-2ea5ac06df40',
            type: 'rule',
            attributes: {
                created_at: '2018-12-07T09:24:29.467Z',
                updated_at: '2018-12-07T09:24:29.467Z',
                ref_id: 'xccdf_org.ssgproject.content_rule_no_empty_passwords',
                title: 'Prevent Log In to Accounts With Empty Password',
                rationale: 'If an account has an empty password, anyone could log in and\nrun commands with the privileges of that account. Accounts with\nempty passwords should never be used in operational environments.',
                description: 'If an account is configured for password authentication\nbut does not have an assigned password, it may be possible to log\ninto the account without authentication. Remove any instances of the nullok\noption in /etc/pam.d/system-auth to\nprevent logins with empty passwords.',
                severity: 'High',
                total_systems_count: 0,
                affected_systems_count: 0
            }
        }
    },
    'xccdf_org.ssgproject.content_rule_bootloader_audit_argument': {
        data: {
            attributes: {
                title: 'Enable Auditing for Processes Which Start Prior to the Audit Daemon'
            }
        }
    },

    'xccdf_org.ssgproject.content_rule_security_patches_up_to_date': {
        data: {
            attributes: {
                title: 'System security patches and updates must be installed and up-to-date.'
            }
        }
    }
});

exports.getRule = async function (id) {
    return P.resolve(DATA[id]);
};

exports.ping = function () {
    return exports.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login');
};


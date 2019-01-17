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
    },

    'xccdf_org.ssgproject.content_rule_grub2_disable_interactive_boot': {
        data: {
            id: '48ff506b-3459-493f-8188-58beec1377a5',
            type: 'rule',
            attributes: {
                created_at: '2018-12-07T09:24:30.002Z',
                updated_at: '2018-12-13T07:45:18.770Z',
                ref_id: 'xccdf_org.ssgproject.content_rule_grub2_disable_interactive_boot',
                title: 'Verify that Interactive Boot is Disabled',
                rationale: 'Using interactive boot, the console user could disable auditing, firewalls,\nor other services, weakening system security.',
                description: 'Red Hat Enterprise Linux systems support an \'interactive boot\' option that can\nbe used to prevent services from being started. On a Red Hat Enterprise Linux 7\nsystem, interactive boot can be enabled by providing a 1,\nyes, true, or on value to the\nsystemd.confirm_spawn kernel argument in /etc/default/grub.\nRemove any instance of systemd.confirm_spawn=(1|yes|true|on) from\nthe kernel arguments in that file to disable interactive boot.',
                severity: 'Medium',
                total_systems_count: 0,
                affected_systems_count: 0
            }
        }
    }
});

const Connector = require('../Connector');

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    getRule (id) {
        return P.resolve(DATA[id]);
    }

    ping () {
        return this.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login');
    }
}();

'use strict';

const P = require('bluebird');

/* eslint max-len: off */
const DATA = Object.freeze({
    'xccdf_org.ssgproject.content_rule_sshd_disable_root_login': {
        created_at: '2018-12-07T09:24:25.577Z',
        updated_at: '2018-12-07T09:24:25.577Z',
        ref_id: 'xccdf_org.ssgproject.content_rule_sshd_disable_root_login',
        title: 'Disable SSH Root Login',
        rationale: 'Even though the communications channel may be encrypted, an additional layer of\nsecurity is gained by extending the policy of not logging directly on as root.\nIn addition, logging in with a user-specific account provides individual\naccountability of actions performed on the system and also helps to minimize\ndirect attack attempts on root\'s password.',
        description: 'The root user should never be allowed to login to a\nsystem directly over a network.\nTo disable root login via SSH, add or correct the following line\nin /etc/ssh/sshd_config:\nPermitRootLogin no',
        severity: 'Medium',
        total_systems_count: 0,
        affected_systems_count: 0
    },
    'xccdf_org.ssgproject.content_rule_no_empty_passwords': {
        created_at: '2018-12-07T09:24:29.467Z',
        updated_at: '2018-12-07T09:24:29.467Z',
        ref_id: 'xccdf_org.ssgproject.content_rule_no_empty_passwords',
        title: 'Prevent Log In to Accounts With Empty Password',
        rationale: 'If an account has an empty password, anyone could log in and\nrun commands with the privileges of that account. Accounts with\nempty passwords should never be used in operational environments.',
        description: 'If an account is configured for password authentication\nbut does not have an assigned password, it may be possible to log\ninto the account without authentication. Remove any instances of the nullok\noption in /etc/pam.d/system-auth to\nprevent logins with empty passwords.',
        severity: 'High',
        total_systems_count: 0,
        affected_systems_count: 0
    },
    'xccdf_org.ssgproject.content_rule_bootloader_audit_argument': {
        title: 'Enable Auditing for Processes Which Start Prior to the Audit Daemon'
    },

    'xccdf_org.ssgproject.content_rule_security_patches_up_to_date': {
        title: 'System security patches and updates must be installed and up-to-date.'
    },

    'xccdf_org.ssgproject.content_rule_grub2_disable_interactive_boot': {
        created_at: '2018-12-07T09:24:30.002Z',
        updated_at: '2018-12-13T07:45:18.770Z',
        ref_id: 'xccdf_org.ssgproject.content_rule_grub2_disable_interactive_boot',
        title: 'Verify that Interactive Boot is Disabled',
        rationale: 'Using interactive boot, the console user could disable auditing, firewalls,\nor other services, weakening system security.',
        description: 'Red Hat Enterprise Linux systems support an \'interactive boot\' option that can\nbe used to prevent services from being started. On a Red Hat Enterprise Linux 7\nsystem, interactive boot can be enabled by providing a 1,\nyes, true, or on value to the\nsystemd.confirm_spawn kernel argument in /etc/default/grub.\nRemove any instance of systemd.confirm_spawn=(1|yes|true|on) from\nthe kernel arguments in that file to disable interactive boot.',
        severity: 'Medium',
        total_systems_count: 0,
        affected_systems_count: 0
    },

    'xccdf_org.ssgproject.content_rule_disable_prelink': {
        title: 'Disable Prelinking'
    },

    'xccdf_org.ssgproject.content_rule_disable_prelink-unresolved': {
        title: 'Disable Prelinking'
    },

    'xccdf_org.ssgproject.content_rule_service_autofs_disabled': {
        title: 'Disable the Automounter'
    },

    'xccdf_org.ssgproject.content_rule_service_rsyslog_enabled': {
        title: 'Enable rsyslog Service'
    },

    'xccdf_org.ssgproject.content_rule_mount_option_dev_shm_nodev': {
        title: 'Add nodev Option to /dev/shm'
    },

    'xccdf_org.ssgproject.content_rule_disable_host_auth': {
        title: 'Disable Host-Based Authentication'
    },

    'xccdf_org.ssgproject.content_rule_rsyslog_remote_loghost': {
        title: 'Ensure Logs Sent To Remote Host'
    },

    'xccdf_org.ssgproject.content_rule_sysctl_net_ipv6_conf_default_accept_source_route': {
        title: 'Test SSG issue'
    },

    'xccdf_org.ssgproject.content_rule_sysctl_kernel_randomize_va_space': {
        title: 'Test SSG issue'
    },

    'xccdf_org.ssgproject.content_rule_sysctl_kernel_yama_ptrace_scope': {
        title: 'Test SSG issue'
    },

    'xccdf_org.ssgproject.content_rule_sysctl_net_ipv4_conf_all_accept_redirects': {
        title: 'Test SSG issue'
    },

    'xccdf_org.ssgproject.content_rule_sysctl_net_ipv4_conf_all_accept_source_route': {
        title: 'Test SSG issue'
    },

    'xccdf_org.ssgproject.content_rule_sysctl_net_ipv4_conf_all_log_martians': {
        title: 'Test SSG issue'
    },

    'xccdf_org.ssgproject.content_rule_sysctl_net_ipv4_conf_all_rp_filter': {
        title: 'Test SSG issue'
    },

    'xccdf_org.ssgproject.content_rule_sysctl_net_ipv4_conf_all_secure_redirects': {
        title: 'Test SSG issue'
    },

    'xccdf_org.ssgproject.content_rule_sysctl_net_ipv4_conf_all_send_redirects': {
        title: 'Test SSG issue'
    },

    'xccdf_org.ssgproject.content_rule_sysctl_net_ipv4_conf_default_accept_redirects': {
        title: 'Test SSG issue'
    },

    'xccdf_org.ssgproject.content_rule_sysctl_net_ipv4_conf_default_accept_source_route': {
        title: 'Test SSG issue'
    },

    'xccdf_org.ssgproject.content_rule_sysctl_net_ipv4_conf_default_log_martians': {
        title: 'Test SSG issue'
    },

    'xccdf_org.ssgproject.content_rule_sysctl_net_ipv4_conf_default_rp_filter': {
        title: 'Test SSG issue'
    },

    'xccdf_org.ssgproject.content_rule_sysctl_net_ipv4_conf_default_secure_redirects': {
        title: 'Test SSG issue'
    },

    'xccdf_org.ssgproject.content_rule_sysctl_net_ipv4_conf_default_send_redirects': {
        title: 'Test SSG issue'
    },

    'xccdf_org.ssgproject.content_rule_sysctl_net_ipv4_icmp_echo_ignore_broadcasts': {
        title: 'Test SSG issue'
    },

    'xccdf_org.ssgproject.content_rule_sysctl_net_ipv4_icmp_ignore_bogus_error_responses': {
        title: 'Test SSG issue'
    },

    'xccdf_org.ssgproject.content_rule_sysctl_net_ipv4_ip_forward': {
        title: 'Test SSG issue'
    },

    'xccdf_org.ssgproject.content_rule_sysctl_net_ipv4_tcp_syncookies': {
        title: 'Test SSG issue'
    },

    'xccdf_org.ssgproject.content_rule_sysctl_net_ipv6_conf_all_accept_ra': {
        title: 'Test SSG issue'
    },

    'xccdf_org.ssgproject.content_rule_sysctl_net_ipv6_conf_all_accept_redirects': {
        title: 'Test SSG issue'
    },

    'xccdf_org.ssgproject.content_rule_sysctl_net_ipv6_conf_all_forwarding': {
        title: 'Test SSG issue'
    },

    'xccdf_org.ssgproject.content_rule_sysctl_net_ipv6_conf_default_accept_ra': {
        title: 'Test SSG issue'
    },

    'xccdf_org.ssgproject.content_rule_sysctl_net_ipv6_conf_default_accept_redirects': {
        title: 'Test SSG issue'
    }
});

const Connector = require('../Connector');

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    getRule (id) {
        return P.resolve(DATA[id]); // eslint-disable-line security/detect-object-injection
    }

    ping () {
        return this.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login');
    }
}();

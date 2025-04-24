'use strict';
/*eslint-disable max-len*/

require('../test');
const identifiers = require('./identifiers');

test('parses a test id', () => {
    const parsed = identifiers.parse('test:reboot');
    parsed.should.have.property('app', 'test');
    parsed.should.have.property('issue', 'reboot');
    parsed.should.have.property('full', 'test:reboot');
});

test('parses an advisor id', () => {
    const parsed = identifiers.parse('advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE');
    parsed.should.have.property('app', 'advisor');
    parsed.should.have.property('issue', 'network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE');
    parsed.should.have.property('full', 'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE');
});

test('parses a vulnerabilities id', () => {
    const parsed = identifiers.parse('vulnerabilities:CVE-2017-5715');
    parsed.should.have.property('app', 'vulnerabilities');
    parsed.should.have.property('issue', 'CVE-2017-5715');
    parsed.should.have.property('full', 'vulnerabilities:CVE-2017-5715');
});

test('parses a vulnerabilities (erratum) id', () => {
    const parsed = identifiers.parse('vulnerabilities:RHBA-2007:0331');
    parsed.should.have.property('app', 'vulnerabilities');
    parsed.should.have.property('issue', 'RHBA-2007:0331');
    parsed.should.have.property('full', 'vulnerabilities:RHBA-2007:0331');
});

test('parses patch (erratum) id', () => {
    const parsed = identifiers.parse('patch-advisory:RHBA-2021:0439');
    parsed.should.have.property('app', 'patch-advisory');
    parsed.should.have.property('issue', 'RHBA-2021:0439');
    parsed.should.have.property('full', 'patch-advisory:RHBA-2021:0439');
});

test('parses patch (package) id', () => {
    const parsed = identifiers.parse('patch-package:libstdc++-8.3.1-5.1.el8.x86_64');
    parsed.should.have.property('app', 'patch-package');
    parsed.should.have.property('issue', 'libstdc++-8.3.1-5.1.el8.x86_64');
    parsed.should.have.property('full', 'patch-package:libstdc++-8.3.1-5.1.el8.x86_64');
});

test('parses a vulnerabilities (csaw) id', () => {
    const parsed = identifiers.parse('vulnerabilities:CVE-2017-5715:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE');
    parsed.should.have.property('app', 'vulnerabilities');
    parsed.should.have.property('issue', 'CVE-2017-5715:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE');
    parsed.should.have.property('full', 'vulnerabilities:CVE-2017-5715:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE');
});

test('parses a ssg id(v1)', () => {
    const parsed = identifiers.parse('ssg:rhel7|pci-dss|xccdf_org.ssgproject.content_rule_sshd_disable_root_login');
    parsed.should.have.property('app', 'ssg');
    parsed.should.have.property('issue', 'rhel7|pci-dss|xccdf_org.ssgproject.content_rule_sshd_disable_root_login');
    parsed.should.have.property('full', 'ssg:rhel7|pci-dss|xccdf_org.ssgproject.content_rule_sshd_disable_root_login');
});

test('parses a ssg id(v2)', () => {
    const parsed = identifiers.parse('ssg:xccdf_org.ssgproject.content_benchmark_RHEL-8|0.0.1|cis_server_l1|xccdf_org.ssgproject.content_rule_selinux_policytype');
    parsed.should.have.property('app', 'ssg');
    parsed.should.have.property('issue', 'xccdf_org.ssgproject.content_benchmark_RHEL-8|0.0.1|cis_server_l1|xccdf_org.ssgproject.content_rule_selinux_policytype');
    parsed.should.have.property('full', 'ssg:xccdf_org.ssgproject.content_benchmark_RHEL-8|0.0.1|cis_server_l1|xccdf_org.ssgproject.content_rule_selinux_policytype');
});

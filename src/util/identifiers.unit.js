'use strict';

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
    const parsed = identifiers.parse('vulnerabilities:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074');
    parsed.should.have.property('app', 'vulnerabilities');
    parsed.should.have.property('issue', 'CVE_2017_6074_kernel|KERNEL_CVE_2017_6074');
    parsed.should.have.property('full', 'vulnerabilities:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074');
});

test('parses a vulnerabilities (erratum) id', () => {
    const parsed = identifiers.parse('vulnerabilities:RHBA-2007:0331');
    parsed.should.have.property('app', 'vulnerabilities');
    parsed.should.have.property('issue', 'RHBA-2007:0331');
    parsed.should.have.property('full', 'vulnerabilities:RHBA-2007:0331');
});

test('parses a compliance id', () => {
    const parsed = identifiers.parse('compliance:sshd_disable_root_login');
    parsed.should.have.property('app', 'compliance');
    parsed.should.have.property('issue', 'sshd_disable_root_login');
    parsed.should.have.property('full', 'compliance:sshd_disable_root_login');
});

'use strict';

const impl = require('./impl');
const base = require('../../test');
const Connector = require('../Connector');
const data = require('./impl.unit.data');
const { mockRequest, mockCache } = require('../testUtils');
const request = require('../../util/request');
const errors = require('../../errors');

/* eslint-disable max-len */
describe('advisor impl', function () {

    beforeEach(mockRequest);

    describe('rule', function () {
        test('obtains rule info', async function () {
            const cache = mockCache();

            const http = base.getSandbox().stub(request, 'run').resolves({
                statusCode: 200,
                body: {
                    id: 243,
                    created_at: '2018-12-21T10:52:42.799623-05:00',
                    updated_at: '2018-12-21T10:52:42.799640-05:00',
                    ruleset: {
                        created_at: '2018-05-21T22:00:51-04:00',
                        updated_at: '2018-05-21T22:00:51-04:00',
                        rule_source: 'https://gitlab.cee.redhat.com/insights-open-source/insights-plugins',
                        description: 'Advisor'
                    },
                    rule_id: 'network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE',
                    description: 'Bonding fails to fail over due to bonding options being parsed incorrectly',
                    severity: 2,
                    active: true,
                    category: {
                        name: 'Stability'
                    },
                    impact: {
                        name: 'Network Connectivity Loss',
                        impact: 3
                    },
                    likelihood: 1,
                    node_id: '438333',
                    tags: 'bonding sbr_networking networking configuration',
                    has_playbook: true,
                    reboot_required: false,
                    publish_date: '2018-11-11T23:48:00-05:00',
                    summary: 'Bonding will not fail over to the backup link when bonding options are partially read.\n',
                    generic: 'Bonding will not fail over to the backup link when bonding options are partially read.\n',
                    reason: 'This host is running with bonding device. Bonding information is detected as follows:\n<table border=\'1\' align=\'left\'>\n  <tr>\n    <th style=\'text-align:center;\'>Master Interface</th>\n    <th style=\'text-align:center;\'>Slave Interface</th>\n  </tr>\n{{ for (var key in pydata.bond_details) { }}\n{{ for (var idx in pydata.bond_details[key]) { }}\n  <tr>\n    <td style=\'text-align:center;\'>{{=key}} </td>\n    <td style=\'text-align:center;\'>{{=pydata.bond_details[key][idx]}} </td>\n  </tr>\n{{ } }}\n{{ } }}\n</table>\n{{ for (var key in pydata.bond_details) { }}\n<p>&nbsp;<br></p>\n<p>&nbsp;</p>\n{{ } }}\n\nBonding options missing quotations are listed below:\n<table border=\'1\' align=\'left\'>\n  <tr>\n    <th style=\'text-align:center;\'>Bonding Device</th>\n    <th style=\'text-align:center;\'>Bonding Options</th>\n  </tr>\n{{ for (var key in pydata.bond_config) { }}\n  <tr>\n    <td style=\'text-align:center;\'>{{=key}}</td>\n    <td style=\'text-align:center;\'>{{=pydata.bond_config[key]}}</td>\n  </tr>\n{{ } }}\n</table>\n<p><br></p>\n{{ for (var key in pydata.bond_config) { }}\n<p>&nbsp;</p>\n{{ } }}\n\nIf the `BONDING_OPTS` line does not have quotations around the options, only the first parameter is being read. The bonding will not fail over to the backup link as expected behaviour.\n',
                    more_info: '',
                    impacted_systems_count: 0,
                    reports_acked: false,
                    resolution_set: [
                        {
                            system_type: 105,
                            resolution: 'Red Hat recommends that you complete the following steps to correct the configuration:\n\n1. Add quotations around the bonding options:\n    <table border=\'1\' align=\'left\'>\n      <tr>\n        <th style=\'text-align:center;\'>Configuration File</th>\n        <th style=\'text-align:center;\'>Original Line</th>\n        <th style=\'text-align:center;\'>After Change</th>\n      </tr>\n    {{ for (var key in pydata.bond_config) { }}\n      <tr>\n        <td style=\'text-align:center;\'>/etc/sysconfig/network-scripts/ifcfg-{{=key}}</td>\n        <td style=\'text-align:center;\'>BONDING_OPTS={{=pydata.bond_config[key]}}</td>\n        <td style=\'text-align:center;\'>BONDING_OPTS=\'{{=pydata.bond_config[key]}}\'</td>\n      </tr>\n    {{ } }}\n    </table>\n1. Restart bonding device:\n    {{ for (var key in pydata.bond_config) { }}\n    ~~~\n    # ifdown {{=key}}\n    # ifup {{=key}}\n    ~~~\n    {{ } }}\n',
                            resolution_risk: {
                                name: 'Update Network Configuration',
                                risk: 3
                            },
                            has_playbook: true
                        }
                    ],
                    total_risk: 2
                },
                headers: {}
            });

            const result = await impl.getRule('network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE');
            result.should.have.property('summary', 'Bonding will not fail over to the backup link when bonding options are partially read.\n');

            http.callCount.should.equal(1);
            const options = http.args[0][0];
            options.headers.should.have.size(2);
            options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
            options.headers.should.have.property('x-rh-identity', 'identity');
            cache.get.callCount.should.equal(1);
            cache.setex.callCount.should.equal(1);

            await impl.getRule('network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE');
            cache.get.callCount.should.equal(2);
            cache.setex.callCount.should.equal(1);
        });

        test('returns null on unknown resolution', async function () {
            const cache = mockCache();

            const http = base.getSandbox().stub(request, 'run').resolves({
                statusCode: 404,
                body: {
                    detail: 'Not found'
                },
                headers: {}
            });

            await expect(impl.getRule('unknown-rule')).resolves.toBeNull();

            http.callCount.should.equal(1);
            cache.get.callCount.should.equal(1);
            cache.setex.callCount.should.equal(0);
        });

        test('status code handling', async function () {
            base.mockRequestStatusCode();
            expect(impl.getRule('network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE')).rejects.toThrowError(errors.DependencyError);
        });
    });

    test('parses diagnosis reports', async function () {
        const spy = base.getSandbox().stub(Connector.prototype, 'doHttp').resolves(data.diagnosis1);

        const diagnosis = await impl.getDiagnosis('id');

        spy.callCount.should.equal(1);
        diagnosis.should.eql({
            'crashkernel_reservation_failed|CRASHKERNEL_RESERVATION_FAILED': {
                rhel_ver: 7,
                msg: '[    0.000000] crashkernel=auto resulted in zero bytes of reserved memory.',
                auto_with_low_ram: true,
                type: 'rule',
                error_key: 'CRASHKERNEL_RESERVATION_FAILED'
            },
            'rhnsd_pid_world_write|RHNSD_PID_WORLD_WRITABLE': {
                kernel: false,
                rel: 7,
                firmware: false,
                smt: false,
                cmd: false,
                vuln: null,
                rt: false,
                cves_fail: ['CVE-2018-3620'],
                cves_pass: [],
                type: 'rule',
                error_key: 'CVE_2018_3620_CPU_KERNEL_NEED_UPDATE'
            }
        });
    });
});

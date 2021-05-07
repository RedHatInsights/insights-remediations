'use strict';

const impl = require('./impl');
const base = require('../../test');
const { mockRequest, mockCache } = require('../testUtils');
const request = require('../../util/request');
const errors = require('../../errors');

/* eslint-disable max-len */
describe('content server impl', function () {

    beforeEach(mockRequest);

    test('obtains resolution info', async function () {
        const cache = mockCache();

        const http = base.getSandbox().stub(request, 'run').resolves({
            statusCode: 200,
            body: [{
                resolution_risk: 3,
                resolution_type: 'fix',
                play: '- name: Correct Bonding Config Items\n  hosts: "{{HOSTS}}"\n  become: true\n  vars:\n    pydata: "{{ insights_report.details[\'network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE\'] }}"\n\n  tasks:\n    - when:\n       - pydata.bond_config is defined\n      block:\n        - name: Add quotes around bonding options\n          lineinfile:\n            dest: "/etc/sysconfig/network-scripts/ifcfg-{{ item.key }}"\n            regexp: \'(^\\s*BONDING_OPTS=)(.*)\'\n            backrefs: yes\n            line: \'\\1"\\2"\'\n          with_dict: "{{ pydata.bond_config }}"\n\n        - name: Restart Network Interfaces\n          shell: ifdown {{item.key}}  && ifup {{item.key}}\n          with_dict: "{{ pydata.bond_config }}"\n',
                description: 'Correct Bonding Config Items',
                path: 'playbooks/networking/bonding/network_bond_opts_config_issue/NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE/rhel_host/fix_fixit.yml'
            }],
            headers: {}
        });

        const result = await impl.getResolutions('network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE');
        result.should.have.length(1);
        const resolution = result[0];
        resolution.should.have.size(5);
        resolution.should.have.property('resolution_risk', 3);
        resolution.should.have.property('resolution_type', 'fix');
        resolution.should.have.property('play');
        resolution.should.have.property('description');
        resolution.should.have.property('version');

        http.callCount.should.equal(1);
        const options = http.args[0][0];
        options.headers.should.have.size(1);
        options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
        cache.get.callCount.should.equal(1);
        cache.setex.callCount.should.equal(1);

        await impl.getResolutions('network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE');
        cache.get.callCount.should.equal(2);
        cache.setex.callCount.should.equal(1);
    });

    test('returns empty array on unknown resolution', async function () {
        const cache = mockCache();

        const http = base.getSandbox().stub(request, 'run').resolves({
            statusCode: 200,
            body: [],
            headers: {}
        });

        await expect(impl.getResolutions('unknown-resolution')).resolves.toEqual([]);

        http.callCount.should.equal(1);
        cache.get.callCount.should.equal(1);
        cache.setex.callCount.should.equal(0);
    });

    test('status code handling', async function () {
        base.mockRequestStatusCode();
        await expect(impl.getResolutions('network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE')).rejects.toThrow(errors.DependencyError);
    });

    test('deals with null play field', async function () {
        base.getSandbox().stub(request, 'run').resolves({
            statusCode: 200,
            body: [{
                resolution_risk: 3,
                resolution_type: 'fix',
                play: '- name: Correct Bonding Config Items\n  hosts: "{{HOSTS}}"\n  become: true\n  vars:\n    pydata: "{{ insights_report.details[\'network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE\'] }}"\n\n  tasks:\n    - when:\n       - pydata.bond_config is defined\n      block:\n        - name: Add quotes around bonding options\n          lineinfile:\n            dest: "/etc/sysconfig/network-scripts/ifcfg-{{ item.key }}"\n            regexp: \'(^\\s*BONDING_OPTS=)(.*)\'\n            backrefs: yes\n            line: \'\\1"\\2"\'\n          with_dict: "{{ pydata.bond_config }}"\n\n        - name: Restart Network Interfaces\n          shell: ifdown {{item.key}}  && ifup {{item.key}}\n          with_dict: "{{ pydata.bond_config }}"\n',
                description: 'Correct Bonding Config Items',
                path: 'playbooks/networking/bonding/network_bond_opts_config_issue/NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE/rhel_host/fix_fixit.yml'
            }, {
                resolution_risk: 2,
                resolution_type: 'workaround',
                play: null,
                description: 'ha-ha',
                path: 'playbooks/networking/bonding/network_bond_opts_config_issue/NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE/rhel_host/workaround.yml'
            }],
            headers: {}
        });

        const result = await impl.getResolutions('network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE');
        result.should.have.length(1);
        const resolution = result[0];
        resolution.should.have.property('resolution_type', 'fix');
    });
});

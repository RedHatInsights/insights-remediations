'use strict';

const impl = require('./impl');
const base = require('../../test');
const { mockRequest, mockCache } = require('../testUtils');
const request = require('../../util/request');

/* eslint-disable max-len */
describe('vulnerabilities impl', function () {

    beforeEach(mockRequest);

    describe('getSystems', function () {
        test('returns system ids', async function () {
            const cache = mockCache();

            const http = base.getSandbox().stub(request, 'run').resolves({
                statusCode: 200,
                body: {
                    meta: {
                        page: 1,
                        page_size: 40,
                        total_items: 1,
                        pages: 1,
                        sort: '',
                        filter: ''
                    },
                    data: [
                        {
                            type: 'system',
                            inventory_id: '802cab91-410f-473b-b4c6-b1524c45ba8c',
                            attributes: {
                                inventory_id: '802cab91-410f-473b-b4c6-b1524c45ba8c',
                                status_id: 0,
                                status_name: 'Not Reviewed'
                            }
                        },
                        {
                            type: 'system',
                            inventory_id: '6ac1bb84-333d-48e5-bf02-7a9b0263d220',
                            attributes: {
                                inventory_id: '6ac1bb84-333d-48e5-bf02-7a9b0263d220',
                                status_id: 0,
                                status_name: 'Not Reviewed'
                            }
                        }
                    ]
                },
                headers: {}
            });

            await expect(impl.getSystems('rule')).resolves.toEqual([
                '802cab91-410f-473b-b4c6-b1524c45ba8c',
                '6ac1bb84-333d-48e5-bf02-7a9b0263d220'
            ]);

            http.callCount.should.equal(1);
            cache.get.callCount.should.equal(0);
            cache.setex.callCount.should.equal(0);
        });

        test('returns empty array on 404', async function () {
            const cache = mockCache();

            const http = base.getSandbox().stub(request, 'run').resolves({
                statusCode: 200,
                body: {
                    meta: {
                        page: 1,
                        page_size: 40,
                        total_items: 1,
                        pages: 1,
                        sort: '',
                        filter: ''
                    },
                    data: []
                },
                headers: {}
            });

            await expect(impl.getSystems('unknown-rule')).resolves.toEqual([]);

            http.callCount.should.equal(1);
            cache.get.callCount.should.equal(0);
            cache.setex.callCount.should.equal(0);
        });
    });

    describe('getResolutions', function () {
        test('returns play information', async function () {
            const http = base.getSandbox().stub(request, 'run').resolves({
                statusCode: 200,
                body: {
                    meta: {
                        page: 1,
                        page_size: 40,
                        total_items: 1,
                        pages: 1,
                        sort: '',
                        filter: ''
                    },
                    data: [
                        {
                            version: 'unknown',
                            resolution_risk: -1,
                            resolution_type: 'fix',
                            play: '- name: Correct Bonding Config Items\n  hosts: "{{HOSTS}}"\n  become: true\n  vars:\n    pydata: "{{ insights_report.details[\'network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE\'] }}"\n\n  tasks:\n    - when:\n       - pydata.bond_config is defined\n      block:\n        - name: Add quotes around bonding options\n          lineinfile:\n            dest: "/etc/sysconfig/network-scripts/ifcfg-{{ item.key }}"\n            regexp: \'(^\\s*BONDING_OPTS=)(.*)\'\n            backrefs: yes\n            line: \'\\1"\\2"\'\n          with_dict: "{{ pydata.bond_config }}"\n\n        - name: Restart Network Interfaces\n          shell: ifdown {{item.key}}  && ifup {{item.key}}\n          with_dict: "{{ pydata.bond_config }}"\n',
                            description: 'Fix Issues caused by [network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE]'
                        }
                    ]
                },
                headers: {}
            });

            const results = await impl.getResolutions('rule');
            http.callCount.should.equal(1);

            const resolution = results[0];
            resolution.should.have.property('description', 'Fix Issues caused by [network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE]');
            resolution.should.have.property('play');
            resolution.should.have.property('resolution_risk', -1);
            resolution.should.have.property('resolution_type', 'fix');
            resolution.should.have.property('version', 'unknown');
        });

        test('returns empty array on 404', async function () {
            const cache = mockCache();

            const http = base.getSandbox().stub(request, 'run').resolves({
                statusCode: 200,
                body: {
                    meta: {
                        page: 1,
                        page_size: 40,
                        total_items: 1,
                        pages: 1,
                        sort: '',
                        filter: ''
                    },
                    data: []
                },
                headers: {}
            });

            await expect(impl.getResolutions('unknown-rule')).resolves.toEqual([]);

            http.callCount.should.equal(1);
            cache.get.callCount.should.equal(0);
            cache.setex.callCount.should.equal(0);
        });
    });
});

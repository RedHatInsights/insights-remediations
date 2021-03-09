'use strict';

const { request, auth } = require('../../test');

const SYSTEMS = [
    'aab9caf3-7bcb-40ed-bcb1-92fc6360a47d',
    'd2a2b428-9115-4096-b61f-b8d3d59169f8',
    'e5704017-2b73-4f34-b72b-213dc8db0bdc'
];

async function createPlaybook (data) {
    const res = await request
    .post('/v1/remediations')
    .set(auth.jharting)
    .send(data)
    .expect(201);

    res.body.should.have.size(1).and.property('id');
    const id = res.body.id;

    return request
    .get(`/v1/remediations/${id}/playbook`)
    .set(auth.jharting)
    .expect(200);
}

describe('playbook contract test', function () {
    test('creates advisor playbook', async function () {
        const res = await createPlaybook({
            name: 'advisor playbook',
            add: {
                issues: [{
                    id: 'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074',
                    resolution: 'selinux_mitigate'
                }, {
                    id: 'advisor:CVE_2017_smbloris_samba|SAMBA_CVE_2017_SMBLORIS_2'
                }],
                systems: SYSTEMS
            }
        });

        const lines = res.text.split('\n');

        const hosts = lines.filter(l => l.startsWith('  hosts:'));
        hosts.should.have.length(5);
        hosts.forEach(line =>
            line.should.eql('  hosts: "test01.rhel7.jharting.local,test02.rhel7.jharting.local,test03"'));

        lines.includes('- name: run insights to obtain latest diagnosis info').should.be.true();
        lines.includes('- name: Reboot system (if applicable)').should.be.true();
        lines.includes('- name: run insights').should.be.true();
    });

    test('creates vulnerability remediation', async function () {
        const cves = [
            'vulnerabilities:CVE-2018-10897',
            'vulnerabilities:CVE-2018-11235',
            'vulnerabilities:CVE-2018-14526',
            'vulnerabilities:CVE-2018-17456',
            'vulnerabilities:CVE-2018-18311',
            'vulnerabilities:CVE-2019-3856'
        ];

        const res = await createPlaybook({
            name: 'vulnerability playbook',
            add: {
                issues: cves.map(cve => ({id: cve})),
                systems: SYSTEMS
            }
        });

        const lines = res.text.split('\n');

        const hosts = lines.filter(l => l.startsWith('  hosts:'));
        hosts.should.have.length(3);
        hosts.forEach(line =>
            line.should.eql('  hosts: "test01.rhel7.jharting.local,test02.rhel7.jharting.local,test03"'));

        lines.includes('- name: update vulnerable packages').should.be.true();
        lines.includes('- name: Reboot system (if applicable)').should.be.true();
        lines.includes('- name: run insights').should.be.true();
    });

    test('creates compliance remediation', async function () {
        const actions = [
            'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_aide_periodic_cron_checking',
            'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_file_groupowner_cron_allow',
            'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_file_groupowner_efi_grub2_cfg',
            'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_file_groupowner_etc_group',
            'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_file_groupowner_etc_gshadow',
            'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_file_groupowner_etc_passwd'
        ];

        const res = await createPlaybook({
            name: 'compliance playbook',
            add: {
                issues: actions.map(cve => ({id: cve})),
                systems: SYSTEMS
            }
        });

        const lines = res.text.split('\n');

        const hosts = lines.filter(l => l.startsWith('  hosts:'));
        hosts.should.have.length(8);
        hosts.forEach(line =>
            line.includes('test01.rhel7.jharting.local,test02.rhel7.jharting.local,test03').should.be.true());
    });
});

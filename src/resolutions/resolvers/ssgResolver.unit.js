'use strict';

const mock = require('../../test');
const ssg = require('../../connectors/ssg');
const resolver = require('./ssgResolver');
const id = require('../../util/identifiers');
const i = require('dedent-js');

test('parses a simple template', async () => {
    mock.sandbox.stub(ssg, 'getTemplate').callsFake(() => i`
        # platform = multi_platform_rhel,multi_platform_fedora
        # reboot = false
        # strategy = restrict
        # complexity = low
        # disruption = low
        - name: "Disable SSH Root Login"
          lineinfile:
            create: yes
            dest: "/etc/ssh/sshd_config"
            regexp: "^PermitRootLogin"
            line: "PermitRootLogin no"
            insertafter: '(?i)^#?authentication'
            validate: sshd -t -f %s
          #notify: restart sshd
          tags:
            @ANSIBLE_TAGS@`);

    const resolution = (await resolver.resolveResolutions(
        id.parse('compliance:xccdf_org.ssgproject.content_rule_sshd_disable_root_login')))[0];
    resolution.needsReboot.should.be.false();
    expect(resolution.template.data).toMatchSnapshot();
});

test('parses a template with reboot', async () => {
    mock.sandbox.stub(ssg, 'getTemplate').callsFake(() => i`
        # platform = multi_platform_rhel,multi_platform_fedora
        # reboot = true
        # strategy = restrict
        # complexity = low
        # disruption = low
        - name: "Enable Auditing for Processes Which Start Prior to the Audit Daemon"
          shell: /sbin/grubby --update-kernel=ALL --args="audit=1"
          tags:
            @ANSIBLE_TAGS@`);

    const resolution = (await resolver.resolveResolutions(
        id.parse('compliance:xccdf_org.ssgproject.content_rule_bootloader_audit_argument')))[0];
    resolution.needsReboot.should.be.true();
    expect(resolution.template.data).toMatchSnapshot();
});

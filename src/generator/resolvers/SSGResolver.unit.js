'use strict';

const mock = require('../../test');
const ssg = require('../../external/ssg');
const resolver = require('./SSGResolver');
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

    const result = await resolver.resolveTemplates(['compliance:sshd_disable_root_login']);
    result.should.have.key('compliance:sshd_disable_root_login');

    const template = result['compliance:sshd_disable_root_login'][0];
    template.needsReboot.should.be.false();
    expect(template.template).toMatchSnapshot();
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

    const result = await resolver.resolveTemplates(['compliance:bootloader_audit_argument']);
    result.should.have.key('compliance:bootloader_audit_argument');

    const template = result['compliance:bootloader_audit_argument'][0];
    template.needsReboot.should.be.true();
    expect(template.template).toMatchSnapshot();
});

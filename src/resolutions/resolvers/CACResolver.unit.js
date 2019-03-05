'use strict';

const mock = require('../../test');
const cac = require('../../connectors/cac');
const resolver = new(require('./CACResolver'))();
const id = require('../../util/identifiers');
const i = require('dedent-js');

test('parses a simple template', async () => {
    mock.sandbox.stub(cac, 'getTemplate').callsFake(() => i`
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
    mock.sandbox.stub(cac, 'getTemplate').callsFake(() => i`
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

test('skips playbooks with blocks', async () => {
    mock.sandbox.stub(cac, 'getTemplate').callsFake(() => i`
        # platform = multi_platform_rhel,multi_platform_fedora
        # reboot = false
        # strategy = restrict
        # complexity = low
        # disruption = low
        - block:
            - name: "Detect shosts.equiv Files on the System"
              find:
                  paths: /
                  recurse: yes
                  patterns: shosts.equiv
              check_mode: no
              register: shosts_equiv_locations

            - name: "Remove Rsh Trust Files"
              file:
                  path: "{{ item.path }}"
                  state: absent
              with_items: "{{ shosts_equiv_locations.files }}"
              when: shosts_equiv_locations and @ANSIBLE_PLATFORM_CONDITION@
          tags:
            @ANSIBLE_TAGS@`);

    const resolutions = (await resolver.resolveResolutions(
        id.parse('compliance:xccdf_org.ssgproject.content_rule_no_rsh_trust_files')));
    resolutions.should.be.empty();
});

test('uses defaults if metadata is absent', async () => {
    mock.sandbox.stub(cac, 'getTemplate').callsFake(() => i`
        - name: "Enable Auditing for Processes Which Start Prior to the Audit Daemon"
          shell: /sbin/grubby --update-kernel=ALL --args="audit=1"
          tags:
            @ANSIBLE_TAGS@`);

    const resolution = (await resolver.resolveResolutions(
        id.parse('compliance:xccdf_org.ssgproject.content_rule_bootloader_audit_argument')))[0];
    resolution.needsReboot.should.be.true();
    expect(resolution.template.data).toMatchSnapshot();
});

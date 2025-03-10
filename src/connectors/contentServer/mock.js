'use strict';

/* eslint max-len: off */
const _ = require('lodash');

const DATA = {
    'network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE': [{
        resolution_type: 'fix',
        description: `Correct Bonding Config Items`,
        version: `a0e934f07d8167073546cbc5108c4345f92559a5`,
        resolution_risk: 3,
        play: `---\n- name: Correct Bonding Config Items\n  hosts: "{{HOSTS}}"\n  become: true\n  vars:\n    pydata: "{{ insights_report.details['network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE'] }}"\n\n  tasks:\n    - when:\n       - pydata.bond_config is defined\n      block:\n        - name: Add quotes around bonding options\n          lineinfile:\n            dest: "/etc/sysconfig/network-scripts/ifcfg-{{ item.key }}"\n            regexp: '(^\\s*BONDING_OPTS=)(.*)'\n            backrefs: yes\n            line: '\\1"\\2"'\n          with_dict: "{{ pydata.bond_config }}"\n\n        - name: Restart Network Interfaces\n          shell: ifdown {{item.key}}  && ifup {{item.key}}\n          with_dict: "{{ pydata.bond_config }}"\n`
    }],
    'CVE_2017_6074_kernel|KERNEL_CVE_2017_6074': [{
        resolution_type: 'kernel_update',
        description: `Update system to the latest kernel and reboot`,
        version: `3f74744ce9b66c20b55f6dd4e580d77d7e7039b1`,
        resolution_risk: 3,
        play: `- name: Update system to the latest kernel and reboot\n  hosts: "{{HOSTS}}"\n  become: true\n  vars:\n    # determine if we need to update the 'kernel' package or 'kernel-rt' package\n    kernel_pkg: "{{'kernel-rt' if 'rt' in ansible_kernel else 'kernel'}}"\n\n  tasks:\n    - name: Update kernel\n      yum:\n        name: "{{kernel_pkg}}"\n        state: latest\n      register: yum\n\n    - when: yum|changed\n      name: set reboot fact\n      set_fact:\n        insights_needs_reboot: True\n\n    - when: not yum|changed\n      # The latest kernel is already installed so boot from it.  Sort the installed kernels\n      # by buildtime and select the one with the most recent build time\n      block:\n      - name: get latest installed {{kernel_pkg}} package version\n        shell: rpm -q {{kernel_pkg}} --queryformat="%{buildtime}\\t%{version}-%{release}.%{arch}\\n" | sort -nr | head -1 | cut -f2\n        register: latest_kernel\n        check_mode: no\n\n      - name: get configured default kernel\n        command: /sbin/grubby --default-kernel\n        register: default_kernel\n        check_mode: no\n\n      - when: default_kernel.stdout.split('-', 1)[1] != latest_kernel.stdout\n        name: set the default kernel to the latest installed\n        command: /sbin/grubby --set-default /boot/vmlinuz-{{latest_kernel.stdout}}\n        register: grub_change\n        check_mode: no\n\n      - when: grub_change|changed\n        name: set reboot fact\n        set_fact:\n          insights_needs_reboot: True\n`
    }, {
        resolution_type: 'mitigate',
        description: `Disable DCCP kernel module`,
        version: `69ee076f2f0704b11845ca1004e10d8ac5a4c864`,
        resolution_risk: 3,
        play: `- name: Disable DCCP kernel module\n  hosts: "{{HOSTS}}"\n  become: true\n\n# Note: It is possible that the issue could be mitigated by enabling\n# SELinux, e.g. if the system has a sufficient policy but is in\n# permissive mode, but disabling dccp is less disruptive to mitigate\n# just this issue.\n\n  tasks:\n    - name: Blacklist the dccp module\n      lineinfile:\n        dest: /etc/modprobe.d/disable-dccp.conf\n        line: "install dccp /bin/true"\n        owner: root\n        group: root\n        mode: 0644\n        state: present\n        create: yes\n\n    - name: Attempt to remove the dccp module\n      command: modprobe -r dccp\n      register: modprobe_result\n      ignore_errors: true\n      check_mode: no\n      \n    - when: modprobe_result|failed\n      name: set reboot fact\n      set_fact:\n        insights_needs_reboot: True\n`
    }, {
        resolution_type: 'selinux_mitigate',
        description: `Make sure SELinux is enabled, enforcing and has selinux-policy-3.13.1-81.el7 or later on RHEL7`,
        version: `3f74744ce9b66c20b55f6dd4e580d77d7e7039b1`,
        resolution_risk: 3,
        play: `- name: Make sure SELinux is enabled, enforcing and has selinux-policy-3.13.1-81.el7 or later on RHEL7\n  hosts: "{{HOSTS}}"\n  become: yes\n  vars:\n    pydata: "{{insights_report.details['CVE_2017_6074_kernel|KERNEL_CVE_2017_6074']}}"\n\n  tasks:\n  - when: insights_report.details['CVE_2017_6074_kernel|KERNEL_CVE_2017_6074'] is defined\n    block:\n    - when: not pydata.selinux_can_help\n      fail:\n        msg: SELinux cannot mitigate the problem on this system.  Please try one of the other playbooks.\n\n    - name: Get selinux mode\n      command: getenforce\n      register: getenforce\n      check_mode: no\n\n    - name: Enable SELinux immediately\n      command: setenforce enforcing\n      # setenforce enforcing will fail if SElinux is disabled so just ignore that situation\n      failed_when: false\n\n    - name: remove selinux=0 and enforcing=0 from grub config file\n      command: /sbin/grubby --update-kernel=ALL --remove-args="selinux enforcing"\n\n    - name: Set SELINUX=enforcing in /etc/selinux/config\n      lineinfile:\n        backup: true\n        dest: /etc/selinux/config\n        regexp: '(?i)^\\s*SELINUX *=.*'\n        line: SELINUX=enforcing\n        state: present\n\n    - when: ansible_distribution_major_version == '7' and\n            pydata.minimal_selinux_policy and pydata.active_policy and\n            pydata.minimal_selinux_policy | version_compare(pydata.active_policy, '>')\n      name: Update selinux-policy package to latest version\n      yum:\n        name: selinux-policy\n        state: latest\n\n    - when: "getenforce.stdout == 'Disabled'"\n      block:\n      - name: SELinux relabel to be done on reboot (note, a relabel may take a while to complete)\n        file:\n          path: /.autorelabel\n          state: touch\n\n      - name: set reboot fact\n        set_fact:\n          insights_needs_reboot: True\n`
    }],
    'bond_config_issue|NO_QUOTES': [{
        resolution_type: 'fix',
        description: `Correct Bonding Config Items`,
        version: `a0e934f07d8167073546cbc5108c4345f92559a5`,
        resolution_risk: 3,
        play: `---\n- name: Correct Bonding Config Items\n  hosts: {{HOSTS}}\n  become: true\n  vars:\n    pydata: "{{ insights_report.details['bond_config_issue|BOND_CONFIG_ISSUE'] }}"\n  tasks:\n\n    - when: \n        - insights_report.details['bond_config_issue|BOND_CONFIG_ISSUE'] is defined\n        - item.value == 2\n      name: Add quotes around bonding options\n      lineinfile:\n        dest: "/etc/sysconfig/network-scripts/ifcfg-{{ item.key }}"\n        regexp: '(^\\s*BONDING_OPTS=)(.*)'\n        backrefs: yes\n        line: '\\1"\\2"'\n      with_dict: "{{ pydata.interface_issue_dict }}"\n\n    - when:\n        - insights_report.details['bond_config_issue|BOND_CONFIG_ISSUE'] is defined\n        - item.value == 1\n      name: lowercase yes in Slave option\n      lineinfile:\n        dest: "/etc/sysconfig/network-scripts/ifcfg-{{ item.key }}"\n        regexp: '(^\\s*SLAVE=)("*YES"*)'\n        backrefs: yes\n        line: '\\1yes'\n      with_dict: "{{ pydata.interface_issue_dict }}"\n`
    }],
    'bond_config_issue|EXTRA_WHITESPACE': [{
        resolution_type: 'fix',
        description: `Correct Bonding Config Items`,
        version: `a0e934f07d8167073546cbc5108c4345f92559a5`,
        resolution_risk: 3,
        play: `---\n- name: Correct Bonding Config Items\n  hosts: "  {{ HOSTS }} "\n  become: true\n  vars:\n    pydata: "{{ insights_report.details['bond_config_issue|BOND_CONFIG_ISSUE'] }}"\n  tasks:\n\n    - when: \n        - insights_report.details['bond_config_issue|BOND_CONFIG_ISSUE'] is defined\n        - item.value == 2\n      name: Add quotes around bonding options\n      lineinfile:\n        dest: "/etc/sysconfig/network-scripts/ifcfg-{{ item.key }}"\n        regexp: '(^\\s*BONDING_OPTS=)(.*)'\n        backrefs: yes\n        line: '\\1"\\2"'\n      with_dict: "{{ pydata.interface_issue_dict }}"\n\n    - when:\n        - insights_report.details['bond_config_issue|BOND_CONFIG_ISSUE'] is defined\n        - item.value == 1\n      name: lowercase yes in Slave option\n      lineinfile:\n        dest: "/etc/sysconfig/network-scripts/ifcfg-{{ item.key }}"\n        regexp: '(^\\s*SLAVE=)("*YES"*)'\n        backrefs: yes\n        line: '\\1yes'\n      with_dict: "{{ pydata.interface_issue_dict }}"\n`
    }]
};

const Connector = require('../Connector');

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    getResolutions (req, id) {
        if (_.has(DATA, id)) {
            return DATA[id]; // eslint-disable-line security/detect-object-injection
        }

        return [];
    }

    ping (req) {
        return this.getResolutions(req, 'network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE');
    }
}();


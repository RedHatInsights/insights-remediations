'use strict';

const _ = require('lodash');
const Connector = require('../Connector');

const DATA = {
    'CVE_2017_6074_kernel|KERNEL_CVE_2017_6074': {
        id: 'CVE_2017_6074_kernel|KERNEL_CVE_2017_6074',
        description: 'Kernel vulnerable to local privilege escalation via DCCP module (CVE-2017-6074)'
    }
};

/* eslint-disable max-len */
const RESOLUTION_DATA = {
    'CVE_2017_6074_kernel|KERNEL_CVE_2017_6074': [{
        version: 'unknown',
        resolution_type: 'fix',
        play: '- name: Correct Bonding Config Items\n  hosts: "{{HOSTS}}"\n  become: true\n  vars:\n    pydata: "{{ insights_report.details[\'CVE_2017_6074_kernel|KERNEL_CVE_2017_6074\'] }}"\n\n  tasks:\n    - when:\n       - pydata.bond_config is defined\n      block:\n        - name: Add quotes around bonding options\n          lineinfile:\n            dest: "/etc/sysconfig/network-scripts/ifcfg-{{ item.key }}"\n            regexp: \'(^\\s*BONDING_OPTS=)(.*)\'\n            backrefs: yes\n            line: \'\\1"\\2"\'\n          with_dict: "{{ pydata.bond_config }}"\n\n        - name: Restart Network Interfaces\n          shell: ifdown {{item.key}}  && ifup {{item.key}}\n          with_dict: "{{ pydata.bond_config }}"\n',
        description: 'Fix Issues caused by [CVE_2017_6074_kernel|KERNEL_CVE_2017_6074]'
    }],
    'CVE_2021_4034_polkit|CVE_2021_4034_POLKIT': [{
        version: "3ca799732e73ea7deb049189ff14be310a225223",
        resolution_type: "temporary_mitigate",
        play: "# CVE-2021-4034 Mitigation Playbook v.1.1\n\n# Copyright (c) 2022  Red Hat, Inc.\n# This program is free software: you can redistribute it and/or modify\n# it under the terms of the GNU General Public License as published by\n# the Free Software Foundation, either version 3 of the License, or\n# (at your option) any later version.\n\n# Warning! Be sure to download the latest version of this script from its primary source:\n# https://access.redhat.com/security/vulnerabilities/RHSB-2022-001\n\n# This playbook will install systemtap utilities and create a systemtap script to prevent\n# pkexec from being executed with an empty first argument. The script will need to be \n# installed each time the system is booted to be effective. You can use this playbook to\n# install the script after booting.\n\n# To use this playbook, set the HOSTS extra var with the name of the hosts or group\n# you wish to modify:\n# ansible-playbook -e HOSTS=web,mail,ns1 CVE-2021-4034_stap_mitigate.yml\n#\n# To verify that the script is installed, issue the command `lsmod` and look for\n# `stap_pkexec_block` in the list of loaded modules.\n#\n# To remove the script after a fixed package has been installed, find the process ID of\n# systemtap with pgrep or ps, for example:\n#\n#  [root@host ~]# ps $(pgrep stap)\n#  23344\n#\n# Then, kill the systemtap process with the SIGTERM signal:\n#\n#  [root@host ~]# kill -s SIGTERM 23344\n#\n# Alternatively, you can reboot the system. When no longer needed,\n# /root/pkexec-block.stp and /root/pkexec-block.log can be removed.\n\n- name: \"[TEMPORARY MITIGATION] Block pkexec with empty first argument with systemtap\"\n  hosts: \"{{HOSTS}}\"\n  become: true\n  vars:\n    insights_signature_exclude: /hosts,/vars/insights_signature\n    insights_signature: !!binary |\n      TFMwdExTMUNSVWRKVGlCUVIxQWdVMGxIVGtGVVZWSkZMUzB0TFMwS1ZtVnljMmx2YmpvZ1IyNTFV\n      RWNnZGpFS0NtbFJTVlpCZDFWQldXWlFhbTg0ZG5jMU9FUXJhalZ3VGtGUmFteFNVUzhyVFdwNGJG\n      aEVWWGxpYnpZeWEwZDBaVlJHY3pVemJuTkVaMEZoU25semFrMEtZMHBXZEZCSFkySTJSRzVKWmxW\n      UGJrMW1Ua280Um1oU1pEbHJja2gyYW1abVpEbGFTVEl5WjFaWVJtSjRVa0ZTUVhvNWF6Tldhbmxx\n      VDNkRmVYTXlkZ3BwYzNSRFJYUlNTbFJIWjNoMlVVbG5hbHBITDBoUmJVZFFaR1ZHVXpJNFpIRm5N\n      VXBuTUcxbVprNXdlbWxWYTJwRkwxWmFSV2xTYkRSTlVHWXJiSGhUQ20xd1pUUTJiVXhpWTFGdFEw\n      WlRlRGczT0ZkdU9UUTJUWEpuUjFKRVEwOVhUMUJJZUc1T1FrbFZiR2gzSzBsMVprWnJhMUZqY2l0\n      RGRHNXVLMkZNUVZFS2NVeFhaVVZuTW5nMk4yTndiVWx5ZFUxMFJXRjVTa2h0WVRSUGExWk1iVGMw\n      Wkhwc1ZVVTNMMlpZTUdRNFdEaEJkazVGUW5CNk0yOUtkVVp4VTNoNlFncFdkM28yZWpacWREUnph\n      MVE0WlhwaFdsazJPVlp2ZFdKa1QwMVZUbFZQTjNSVldWVkxlRXRLVW1JeGVVaERSMGd5YVRaWFFs\n      VjBORzVpVFZwTmJsRnNDbVZCUldkbldYTXhRM0J3TmxaMFVGVmhMMG95SzJJMVlVaGtTbU5GTHk5\n      eE1VczNVVVYxUkU0eFlqUjVWWEZpZUhNNE5IVkVZa0Z5V0doSVNtUTRNU3NLVDJkb1RqRlVMM0F3\n      V1VkNlpHSjBSbkp3T0RkNmVrMVlURU5MYXpKNVdsaFRNVVppUW1kbVRIVjBlbnBYUzFkcmFrdE1l\n      V001TTNkVVdGTlBXWFYzZUFwWVpVaGtlWE5wYjIxa04yNW1WMFJ1WVZCVlJsQk1SakpRVTJkeVNT\n      czJUVWx0VDB0eFNtRkJUbFpMZDA1VFpXSklhblEwTjB4aEszUmlSV2h4U1dod0NsaFVVbG8wTDFn\n      cldVRk5VVmd4WlVWVmFXOW9kbEpsWlRaVWR6TkJNV3hDUzBkRk1uVnFSbGgwUkhoRmFFTkZRVVJD\n      TmtJNVdsSXdOa2xoTjI0MmN6QUtjVWRUV0ZGVlNqVlVkM0Z1UWpJMmJUbHVObG94VGxaVVMwZHRS\n      V0l6YnpWT2VtVTRaMHBJTjFReUswMDNXak5hUm1SaldtMTRaRGRuUjIwMlExVklSd3BWUzB3NVdE\n      bHZUMVJUV1QwS1BXUklWa2NLTFMwdExTMUZUa1FnVUVkUUlGTkpSMDVCVkZWU1JTMHRMUzB0Q2c9\n      PQ==\n\n\n  tasks:\n    - name: Install systemtap packages\n      yum:\n        name:\n          - systemtap\n          - yum-utils\n          - kernel-devel-{{ ansible_kernel }}\n\n    - when: ansible_distribution_major_version == '7'\n      name: (RHEL 7) Install kernel debuginfo\n      command: debuginfo-install -y kernel-{{ ansible_kernel }}\n\n    - when: (ansible_distribution_major_version == '6' or ansible_distribution_major_version == '8')\n      name: (RHEL 6/8) Install polkit debuginfo\n      command: debuginfo-install -y polkit\n\n# RHEL6 with SELinux enabled needs libselinux-python for Ansible copy operation to work.\n    - when: ansible_distribution_major_version == '6'\n      name: (RHEL 6) Install libselinux-python\n      yum:\n        name:\n          - libselinux-python\n\n    - name: Create systemtap script\n      copy:\n        dest: /root/pkexec-block.stp\n        owner: root\n        group: root\n        mode: '0600'\n        force: false\n        content: |\n          probe process(\"/usr/bin/pkexec\").function(\"main\")  {\n            if (cmdline_arg(1) == \"\")\n              raise(9);\n          }\n\n    - name: Checking if stap_pkexec_block module is already loaded\n      command: grep -Fq stap_pkexec_block /proc/modules\n      register: loaded_module\n      changed_when: false\n      failed_when: loaded_module.rc == 2\n      check_mode: false\n\n    - when: loaded_module.rc == 1\n      name: Install systemtap script\n      command: stap -F -o /root/pkexec-block.log -S 1 -m stap_pkexec_block -g /root/pkexec-block.stp\n      register: stap_run\n      failed_when: false\n\n    - when: stap_run.rc |default(0) != 0\n      fail:\n        msg: \"The systemtap script could not be installed. If this system has Secure Boot enabled, a signed kernel module must be generated to use this mitigation. See the Security Bulletin for more information.\"\n",
        description: "[TEMPORARY MITIGATION] Block pkexec with empty first argument with systemtap",
        reboot_required: false
    },{
        version: "3ca799732e73ea7deb049189ff14be310a225223",
        resolution_type: "update",
        play: "# Fix CVE-2021-4034 by updating the `polkit` package\n\n- name: Update polkit to fix CVE-2021-4034\n  hosts: \"{{HOSTS}}\"\n  become: true\n  vars:\n    insights_signature_exclude: /hosts,/vars/insights_signature\n    insights_signature: !!binary |\n      TFMwdExTMUNSVWRKVGlCUVIxQWdVMGxIVGtGVVZWSkZMUzB0TFMwS1ZtVnljMmx2YmpvZ1IyNTFV\n      RWNnZGpFS0NtbFJTVlpCZDFWQldXWkNRVkp6ZG5jMU9FUXJhalZ3VGtGUmFrUkJRUzhyVFdKWUx6\n      Z3hNbE55UWl0eWFVUXljVk5DUXpSS2JtWk9TRVYzYkc5aFJrMEtiVTVSYlhGTlJXdFJjM0ZuVG5n\n      NFprNTJXbGRHUm5oWVpUZElkMUIyUjNCa09Ha3ZUMUZYY0ZkdVdVdEpVekV3Y0ZFd2VFOW5Relp3\n      WTBoR1NFVXdNZ3B0TXpFNGNuSnJVWE40VWpWM1dqTXpWVmhvTldNMmFXSnVWMkpIVjNORVVETkJP\n      SGhOWmxWUldVTk1RV1F3ZFZKbVdFd3dWR2x0WW13eGNWQk9NVVpyQ21SM1RGSXhSWEJzWkZCdFFU\n      bFFLMlZET1hkb1JtUkhjRGxrV1RoUmFuQlhSR3BPWVdkck9URXpjVUZCVUdWUFVVTkhPRGQwWW05\n      M2JYQlZVSE0zVjBFS1VHdEdXWGN6Wlc5cWVsSkhRMFZKTHpsNVNtWkNOSGhZWjNVMVRHcGljRWgx\n      VEV0amNIUlhUemN3UXpkcGNYRXJZaTlyTVdJdlIyTk5iVkJUYTNWTFJ3cEZOa1JhTVhKS2VHODVO\n      WGgyTldZNVRYcEpkMU5wUkd3MWQwNDJUMnQ1ZDNFelNtTmlXWFZ3YXpWVVV6ZFVOM2R4VFZGWlZX\n      RkpWaTlWZW1WVGFtOTNDa1pXVGxCemNFWlZkM2hUTm1SeE4zVXZaeklyTDB4MFVXWk1Xa1JTWVRG\n      RGRXWnZNVFJLYkVwRVlVZFhOekJLY1ZoT2VWTnVaREpEYkVWVmNtVnRWR1FLVUdVMmNIbGhVM1po\n      U2xCcWVIcEtUa0pQWkVwMldIcHROVlpyYkVzMVZEZENRamR4TXpCQ2FuSXJVVzA1TjNGUFdsbHRk\n      MWhuUjNVMmFYaERjSEZQVndwU2NqbGpaelpLYjFwb1JqRXdNbmhxUVVKcVdFNDJSV0ZrWVZKTFlV\n      OTBSVFF3VVV4amIxSmhWV0ZEWldGNmFrZ3diRU5HVXpCeFNEVkJTVUZrVFZJMENpdERiRWx0WTIx\n      b1RrczRValJ6YUhkclVFVkVNVVJVUjJZdlNqQkdjMVI1UlRsR2IwOVdURkFyWjFsaVVqTlljVFZI\n      U0dkeVNsSnpNREJoVHpsU2JtUUthV1p0YWtoM09XOVBhM2REYmpabGJ6QkZRVWhVZVhsWFdGRm5S\n      WEV4WTNwdlprZHNWakJ5V1daSmJ6ZHJRbnBzWTFrMGVYZFhjRzlIVlZkdFNYaDZid28yYjNJMVZr\n      dFllbTQyVlQwS1BURldhbk1LTFMwdExTMUZUa1FnVUVkUUlGTkpSMDVCVkZWU1JTMHRMUzB0Q2c9\n      PQ==\n\n\n  tasks:\n    - name: Update polkit\n      yum:\n        name: polkit\n        state: latest\n",
        description: "Update polkit to fix CVE-2021-4034",
        reboot_required: false
    }]
};

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    // TODO: this function is not implemented in the real version of this connector,
    //       it is only used in ping() below and should be removed.
    getRule (id) {
        if (_.has(DATA, id)) {
            // eslint-disable-next-line security/detect-object-injection
            return DATA[id];
        }

        return null;
    }

    getSystems () {
        return [
            '2317adf3-911e-4db3-84fd-27fad9724196',
            '286f602a-157f-4095-8bf2-ad4849ab6c43'
        ];
    }

    getResolutions (id) {
        if (_.has(RESOLUTION_DATA, id)) {
            // eslint-disable-next-line security/detect-object-injection
            return RESOLUTION_DATA[id];
        }

        return null;
    }

    ping () {
        return this.getRule('CVE_2017_6074_kernel|KERNEL_CVE_2017_6074');
    }
}();

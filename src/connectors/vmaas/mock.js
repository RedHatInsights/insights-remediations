'use strict';

const P = require('bluebird');
const Connector = require('../Connector');

/* eslint-disable security/detect-object-injection, max-len */

const ERRATA = {
    'RHSA-2018:0502': {
        description: 'The kernel-alt packages provide the Linux kernel version 4.x.\n\nSecurity Fix(es):\n\n* hw: cpu: speculative execution permission faults handling (CVE-2017-5754, Important)(ppc only)\n\n* kernel: Race condition in raw_sendmsg function allows denial-of-service or kernel addresses leak (CVE-2017-17712, Important)\n\n* kernel: mm/pagewalk.c:walk_hugetlb_range function mishandles holes in hugetlb ranges causing information leak (CVE-2017-16994, Moderate)\n\nBug Fix(es):\n\n* When changing the Maximum Transmission Unit (MTU) size on Broadcom BCM5717, BCM5718 and BCM5719 chipsets, the tg3 driver sometimes lost synchronization with the device. Consequently, the device became unresponsive. With this update, tg3 has been fixed, and devices no longer hang due to this behavior. (BZ#1533478)\n\n* Previously, the perf tool used strict string matching to provide related events to a particular CPUID instruction. Consequently, the events were not available on certain IBM PowerPC systems. This update fixes perf to use regular expressions instead of string matching of the entire CPUID string. As a result, the perf tool now supports events on IBM PowerPC architectures as expected. (BZ#1536567)\n\n* Previously, the kernel debugfs file system implemented removal protection based on sleepable read-copy-update (SRCU), which slowed down the drivers relying on the debugfs_remove_recursive() function. Consequently, a decrease in performance or a deadlock sometimes occurred. This update implements per-file removal protection in debugfs. As a result, the performance of the system has improved significantly. (BZ#1538030)\n\n* When running the \'perf test\' command on a PowerKVM guest multiple times, the branch instructions recorded in Branch History Rolling Buffer (BHRB) entries were sometimes unmapped before the kernel processed the entries. Consequently, the operating system terminated unexpectedly. This update fixes the bug, and the operating system no longer crashes in the described situation. (BZ#1538031)'
    },
    'RHSA-2017:2679': {
        description: 'The kernel packages contain the Linux kernel, the core of any Linux operating system.\n\nSecurity Fix(es):\n\n* A stack buffer overflow flaw was found in the way the Bluetooth subsystem of the Linux kernel processed pending L2CAP configuration responses from a client. On systems with the stack protection feature enabled in the kernel (CONFIG_CC_STACKPROTECTOR=y, which is enabled on all architectures other than s390x and ppc64[le]), an unauthenticated attacker able to initiate a connection to a system via Bluetooth could use this flaw to crash the system. Due to the nature of the stack protection feature, code execution cannot be fully ruled out, although we believe it is unlikely. On systems without the stack protection feature (ppc64[le]; the Bluetooth modules are not built on s390x), an unauthenticated attacker able to initiate a connection to a system via Bluetooth could use this flaw to remotely execute arbitrary code on the system with ring 0 (kernel) privileges. (CVE-2017-1000251, Important)\n\nRed Hat would like to thank Armis Labs for reporting this issue.'
    },
    'RHSA-2017:1852': {
        description: 'OpenLDAP is an open-source suite of Lightweight Directory Access Protocol (LDAP) applications and development tools. LDAP is a set of protocols used to access and maintain distributed directory information services over an IP network. The openldap packages contain configuration files, libraries, and documentation for OpenLDAP.\n\nThe following packages have been upgraded to a later upstream version: openldap (2.4.44). (BZ#1386365)\n\nSecurity Fix(es):\n\n* A double-free flaw was found in the way OpenLDAP\'s slapd server using the MDB backend handled LDAP searches. A remote attacker with access to search the directory could potentially use this flaw to crash slapd by issuing a specially crafted LDAP search query. (CVE-2017-9287)\n\nAdditional Changes:\n\nFor detailed information on changes in this release, see the Red Hat Enterprise Linux 7.4 Release Notes linked from the References section.'
    },
    'RHSA-2017:1382': {
        description: 'The sudo packages contain the sudo utility which allows system administrators to provide certain users with the permission to execute privileged commands, which are used for system management purposes, without having to log in as root.\n\nSecurity Fix(es):\n\n* A flaw was found in the way sudo parsed tty information from the process status file in the proc filesystem. A local user with privileges to execute commands via sudo could use this flaw to escalate their privileges to root. (CVE-2017-1000367)\n\nRed Hat would like to thank Qualys Security for reporting this issue.'
    },
    'RHBA-2007:0331': {
        description: 'The Conga package is a web-based administration tool for remote cluster and\r\nstorage management.\r\n\r\nThis erratum applies the following bug fixes:\r\n\r\n- The borrowed Zope packages used by Conga have been patched to eliminate\r\na possibility of XSS attack.\r\n- Passwords are no longer sent back from the server in cleartext for use as\r\ninput values.\r\n- A form error was fixed so that Conga no longer allows for cluster\r\nnames of over 15 characters.\r\n- An error wherein clusters and systems could not be deleted from the\r\nmanage systems interface has been addressed.\r\n- Entering an incorrect password for a system no longer generates an\r\nUnbound Local Reference exception.\r\n- Luci failover domain forms are no longer empty\r\n- The fence_xvm string in cluster.conf for virtual cluster fencing has been\r\ncorrected.\r\n- The advanced options parameters section has been fixed.\r\n- A bug where virtual services were unable for configuration has been\r\naddressed.\r\n- kmod-gfs-xen is now installed when necessary.\r\n- The \'enable shared storage support\' checkbox is now cleared when a\r\nconfiguration error is encountered.\r\n- When configuring an outer physical cluster, it is no longer necessary to\r\nadd the fence_xvmd tag manually.\r\n\r\nUsers of Conga are advised to upgrade to these updated packages, which\r\napply these fixes.'
    },
    'RHSA-2018:0007': {
        description: 'The kernel packages contain the Linux kernel, the core of any Linux operating system.\n\nSecurity Fix(es):\n\nAn industry-wide issue was found in the way many modern microprocessor designs have implemented speculative execution of instructions (a commonly used performance optimization). There are three primary variants of the issue which differ in the way the speculative execution can be exploited.\n\nNote: This issue is present in hardware and cannot be fully fixed via software update. The updated kernel packages provide software mitigation for this hardware issue at a cost of potential performance penalty. Please refer to References section for further information about this issue and the performance impact.\n\nIn this update mitigations for x86-64 architecture are provided.\n\nVariant CVE-2017-5753 triggers the speculative execution by performing a bounds-check bypass. It relies on the presence of a precisely-defined instruction sequence in the privileged code as well as the fact that memory accesses may cause allocation into the microprocessor\'s data cache even for speculatively executed instructions that never actually commit (retire). As a result, an unprivileged attacker could use this flaw to cross the syscall boundary and read privileged memory by conducting targeted cache side-channel attacks. (CVE-2017-5753, Important)\n\nVariant CVE-2017-5715 triggers the speculative execution by utilizing branch target injection. It relies on the presence of a precisely-defined instruction sequence in the privileged code as well as the fact that memory accesses may cause allocation into the microprocessor\'s data cache even for speculatively executed instructions that never actually commit (retire). As a result, an unprivileged attacker could use this flaw to cross the syscall and guest/host boundaries and read privileged memory by conducting targeted cache side-channel attacks. (CVE-2017-5715, Important)\n\nVariant CVE-2017-5754 relies on the fact that, on impacted microprocessors, during speculative execution of instruction permission faults, exception generation triggered by a faulting access is suppressed until the retirement of the whole instruction block. In a combination with the fact that memory accesses may populate the cache even when the block is being dropped and never committed (executed), an unprivileged local attacker could use this flaw to read privileged (kernel space) memory by conducting targeted cache side-channel attacks. (CVE-2017-5754, Important)\n\nNote: CVE-2017-5754 affects Intel x86-64 microprocessors. AMD x86-64 microprocessors are not affected by this issue.\n\nRed Hat would like to thank Google Project Zero for reporting these issues.'
    }
};

const CVES = {
    'CVE-2017-15126': {
        description: 'A flaw was found in the Linux kernel\'s handling of fork failure when dealing with event messages in the userfaultfd code. Failure to fork correctly can create a fork event that will be removed from an already freed list of events.'
    },
    'CVE-2017-17712': {
        description: 'A flaw was found in the Linux kernel\'s implementation of raw_sendmsg allowing a local attacker to panic the kernel or possibly leak kernel addresses. A local attacker, with the privilege of creating raw sockets, can abuse a possible race condition when setting the socket option to allow the kernel to automatically create ip header values and thus potentially escalate their privileges.',
        synopsis: 'CVE-2017-17712',
        impact: 'Important'
    },
    'CVE-2017-17713': {
        description: 'Trape before 2017-11-05 has SQL injection via the /nr red parameter, the /nr vId parameter, the /register User-Agent HTTP header, the /register country parameter, the /register countryCode parameter, the /register cpu parameter, the /register isp parameter, the /register lat parameter, the /register lon parameter, the /register org parameter, the /register query parameter, the /register region parameter, the /register regionName parameter, the /register timezone parameter, the /register vId parameter, the /register zip parameter, or the /tping id parameter.'
    },
    'CVE-2017-5715': {
        description: 'An industry-wide issue was found in the way many modern microprocessor designs have implemented speculative execution of instructions (a commonly used performance optimization). There are three primary variants of the issue which differ in the way the speculative execution can be exploited. Variant CVE-2017-5715 triggers the speculative execution by utilizing branch target injection. It relies on the presence of a precisely-defined instruction sequence in the privileged code as well as the fact that memory accesses may cause allocation into the microprocessor\'s data cache even for speculatively executed instructions that never actually commit (retire). As a result, an unprivileged attacker could use this flaw to cross the syscall and guest/host boundaries and read privileged memory by conducting targeted cache side-channel attacks.'
    }

};

const PACKAGES = {
    'rpm-4.14.2-37.el8.x86_64': {
        description: 'RPM package manager.'
    },
    'systemd-239-13.el8_0.5.x86_64': {
        description: 'systemd is a system and service manager that runs as PID 1 and starts.'
    },
    'libstdc++-8.3.1-5.1.el8.x86_64': {
        description: 'GNU Standard C++ Library'
    },
    'qemu-guest-agent-15:4.2.0-34.module+el8.3.0+8829+e7a0a3ea.1.x86_64': {
        description: 'QEMU Guest Agent'
    },
    'sOME.my-odd_++pkg-1000:11.23.444.5-8.1.el8.x86_64': {
        description: 'Some testing rpm with weird package name'
    },
    'libgudev1-219-78.el7_9.3.x86_64': {
        description: 'Libraries for adding libudev support'
    }
};

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    getErratum (id) {
        return P.resolve(ERRATA[id]);
    }

    getCve (id) {
        return P.resolve(CVES[id]);
    }

    getPackage (id) {
        const ret = PACKAGES[id] || {};
        return P.resolve(ret);
    }

    ping () {
        return this.getCve('CVE-2017-17712');
    }
}();


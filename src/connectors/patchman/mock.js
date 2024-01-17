'use strict';

const P = require('bluebird');
const Connector = require('../Connector');

/* eslint-disable security/detect-object-injection, max-len */

const ERRATA = {
    'RHBA-2019:4105': {
        attributes: {
            description: 'Red Hat Satellite is a system management solution that allows organizations to configure and maintain their systems without the necessity to provide public Internet access to their servers or other client systems. It performs provisioning and configuration management of predefined standard operating environments.\n\nThis update fixes the following bug: \n\n* There was a problem causing memory leakage from qpid-proton. (BZ#1769895)\n\nUsers of Red Hat Satellite Tools on all Red Hat Enterprise Linux versions are advised to upgrade to these updated packages.',
            synopsis: 'Satellite Tools 6.6.1 Async Bug Fix Update',
            reboot_required: false
        },
        id: 'RHBA-2019:4105',
        type: 'advisory'
    },
    'RHBA-2019:0689': {
        attributes: {
            description: 'The tzdata packages contain data files with rules for various time zones.\n\nThe tzdata packages have been updated to version 2019a, which addresses recent time zone changes. Notably:\n\n* The Asia/Hebron and Asia/Gaza zones will start DST on 2019-03-30, rather than 2019-03-23 as previously predicted.\n* Metlakatla rejoined Alaska time on 2019-01-20, ending its observances of Pacific standard time.\n\n(BZ#1692616, BZ#1692615, BZ#1692816)\n\nUsers of tzdata are advised to upgrade to these updated packages.',
            synopsis: 'tzdata bug fix and enhancement update',
            reboot_required: false
        },
        id: 'RHBA-2019:0689',
        type: 'advisory'
    },
    'RHBA-2019:2871': {
        attributes: {
            description: 'The tzdata packages contain data files with rules for various time zones.\n\nThe tzdata packages have been updated to version 2019c, which addresses recent\ntime zone changes. Notably:\n\n* Fiji will observe the daylight saving time (DST) from November 10, 2019 to January 12, 2020. \n\n* Norfolk Island will start to observe Australian-style DST on November 06, 2019.\n(BZ#1751551, BZ#1751737, BZ#1751402, BZ#1751404)\n\nUsers of tzdata are advised to upgrade to these updated packages, which add\nthese enhancements.',
            synopsis: 'tzdata enhancement update',
            reboot_required: false
        },
        id: 'RHBA-2019:2871',
        type: 'advisory'
    },
    'RHBA-2024:101234': {
        attributes: {
            description: 'The sudo packages contain the sudo utility which allows system administrators to provide certain users with the permission to execute privileged commands, which are used for system management purposes, without having to log in as root.\n\nSecurity Fix(es):\n\n* A flaw was found in the way sudo parsed tty information from the process status file in the proc filesystem. A local user with privileges to execute commands via sudo could use this flaw to escalate their privileges to root. (CVE-2017-1000367)\n\nRed Hat would like to thank Qualys Security for reporting this issue.',
            synopsis: 'sudo update',
            reboot_required: false
        },
        id: 'RHBA-2024:101234',
        type: 'advisory'
    },
    'RHSA-2019:1873': {
        attributes: {
            description: 'Important: kernel security, bug fix and enhancement update',
            synopsis: 'Important: kernel security, bug fix and enhancement update',
            reboot_required: true
        },
        id: 'RHSA-2019:1873',
        type: 'advisory'
    },
    'FEDORA-EPEL-2021-1ad3a13e05': {
        attributes: {
            description: 'The tzdata packages contain data files with rules for various time zones.\n\nThe tzdata packages have been updated to version 2019c, which addresses recent\ntime zone changes. Notably:\n\n* Fiji will observe the daylight saving time (DST) from November 10, 2019 to January 12, 2020. \n\n* Norfolk Island will start to observe Australian-style DST on November 06, 2019.\n(BZ#1751551, BZ#1751737, BZ#1751402, BZ#1751404)\n\nUsers of tzdata are advised to upgrade to these updated packages, which add\nthese enhancements.',
            synopsis: 'tzdata enhancement update',
            reboot_required: false
        },
        id: 'FEDORA-EPEL-2021-1ad3a13e05',
        type: 'advisory'
    }
};

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    getErratum (id) {
        return P.resolve(ERRATA[id]);
    }

    ping () {
        return this.getErratum('RHBA-2019:4105');
    }
}();

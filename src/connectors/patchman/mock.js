'use strict';

const P = require('bluebird');
const Connector = require('../Connector');

/* eslint-disable security/detect-object-injection, max-len */

const ERRATA = {
    'RHBA-2019:4105': {
        attributes: {
            description: 'Red Hat Satellite is a system management solution that allows organizations to configure and maintain their systems without the necessity to provide public Internet access to their servers or other client systems. It performs provisioning and configuration management of predefined standard operating environments.\n\nThis update fixes the following bug: \n\n* There was a problem causing memory leakage from qpid-proton. (BZ#1769895)\n\nUsers of Red Hat Satellite Tools on all Red Hat Enterprise Linux versions are advised to upgrade to these updated packages.',
            synopsis: 'Satellite Tools 6.6.1 Async Bug Fix Update'
        },
        id: 'RHBA-2019:4105',
        type: 'advisory'
    },
    'RHBA-2019:0689': {
        attributes: {
            description: 'The tzdata packages contain data files with rules for various time zones.\n\nThe tzdata packages have been updated to version 2019a, which addresses recent time zone changes. Notably:\n\n* The Asia/Hebron and Asia/Gaza zones will start DST on 2019-03-30, rather than 2019-03-23 as previously predicted.\n* Metlakatla rejoined Alaska time on 2019-01-20, ending its observances of Pacific standard time.\n\n(BZ#1692616, BZ#1692615, BZ#1692816)\n\nUsers of tzdata are advised to upgrade to these updated packages.',
            synopsis: 'tzdata bug fix and enhancement update'
        },
        id: 'RHBA-2019:0689',
        type: 'advisory'
    },
    'RHBA-2019:2871': {
        attributes: {
            description: 'The tzdata packages contain data files with rules for various time zones.\n\nThe tzdata packages have been updated to version 2019c, which addresses recent\ntime zone changes. Notably:\n\n* Fiji will observe the daylight saving time (DST) from November 10, 2019 to January 12, 2020. \n\n* Norfolk Island will start to observe Australian-style DST on November 06, 2019.\n(BZ#1751551, BZ#1751737, BZ#1751402, BZ#1751404)\n\nUsers of tzdata are advised to upgrade to these updated packages, which add\nthese enhancements.',
            synopsis: 'tzdata enhancement update'
        },
        id: 'RHBA-2019:2871',
        type: 'advisory'
    },
    'FEDORA-EPEL-2021-1ad3a13e05': {
        attributes: {
            description: 'The tzdata packages contain data files with rules for various time zones.\n\nThe tzdata packages have been updated to version 2019c, which addresses recent\ntime zone changes. Notably:\n\n* Fiji will observe the daylight saving time (DST) from November 10, 2019 to January 12, 2020. \n\n* Norfolk Island will start to observe Australian-style DST on November 06, 2019.\n(BZ#1751551, BZ#1751737, BZ#1751402, BZ#1751404)\n\nUsers of tzdata are advised to upgrade to these updated packages, which add\nthese enhancements.',
            synopsis: 'tzdata enhancement update'
        },
        id: 'FEDORA-EPEL-2021-1ad3a13e05',
        type: 'advisory'
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

    getPackage (id) {
        const ret = PACKAGES[id] || {};
        return P.resolve(ret);
    }

    ping () {
        return this.getCve('RHBA-2019:4105');
    }
}();

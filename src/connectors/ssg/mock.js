'use strict';

const fs = require('fs');
const path = require('path');
const Connector = require('../Connector');
const identifiers = require('../../util/identifiers');

function read (dir, file) {
    return fs.readFileSync(path.join(__dirname, 'mock', dir, `${file}.yml`), 'utf-8');
}

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    async getTemplate (id) {
        identifiers.parseSSG(id);

        switch (id.full) {
            case 'ssg:rhel7|pci-dss|xccdf_org.ssgproject.content_rule_disable_prelink':
                return read('pci-dss', 'disable_prelink');
            case 'ssg:rhel7|pci-dss|xccdf_org.ssgproject.content_rule_disable_prelink-unresolved':
                return read('pci-dss', 'disable_prelink-unresolved');
            case 'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_security_patches_up_to_date':
                return read('standard', 'security_patches_up_to_date');
            case 'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_service_autofs_disabled':
                return read('standard', 'service_autofs_disabled');
            case 'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_service_rsyslog_enabled':
                return read('standard', 'service_rsyslog_enabled');
            case 'ssg:rhel7|ospp42|xccdf_org.ssgproject.content_rule_mount_option_dev_shm_nodev':
                return read('ospp42', 'mount_option_dev_shm_nodev');
            default: return null;
        }
    }

    ping () {
        return true;
    }
}();

'use strict';

const fs = require('fs');
const path = require('path');
const Connector = require('../Connector');

function read (dir, file) {
    return {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        template: fs.readFileSync(path.join(__dirname, 'mock', dir, `${file}.yml`), 'utf-8'),
        version: 'mock'
    };
}

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    async getTemplate (req, platform, profile, rule) {
        switch (`${platform}|${profile}|${rule}`) {
            case 'rhel7|pci-dss|disable_prelink':
                return read('pci-dss', 'disable_prelink');
            case 'rhel7|all|disable_prelink':
                return read('pci-dss', 'disable_prelink');
            case 'rhel7|pci-dss|disable_prelink-unresolved':
                return read('pci-dss', 'disable_prelink-unresolved');
            case 'rhel7|standard|security_patches_up_to_date':
                return read('standard', 'security_patches_up_to_date');
            case 'rhel7|standard|service_autofs_disabled':
                return read('standard', 'service_autofs_disabled');
            case 'rhel7|standard|service_rsyslog_enabled':
                return read('standard', 'service_rsyslog_enabled');
            case 'rhel7|standard|rsyslog_remote_loghost':
                return read('standard', 'rsyslog_remote_loghost');
            case 'rhel7|ospp|mount_option_dev_shm_nodev':
                return read('ospp', 'mount_option_dev_shm_nodev');
            case 'rhel7|C2S|disable_host_auth':
                return read('C2S', 'disable_host_auth');
            default: return null;
        }
    }

    ping (req) {
        return true;
    }
}();

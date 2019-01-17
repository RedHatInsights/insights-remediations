'use strict';

const config = require('../../config');
const request = require('../http');
const URI = require('urijs');
const Connector = require('../Connector');

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    getErratum (id) {
        const uri = new URI(config.vmaas.host);
        uri.path('/api/v1/errata');
        uri.segment(id);

        return request({
            uri: uri.toString(),
            method: 'GET',
            json: true
        }, true).then(res => {
            if (res) {
                return res.errata_list[id];
            }

            return res;
        });
    }

    getCve (id) {
        const uri = new URI(config.vmaas.host);
        uri.path('/api/v1/cves');
        uri.segment(id);

        return request({
            uri: uri.toString(),
            method: 'GET',
            json: true
        }, true).then(res => {
            if (res) {
                return res.cve_list[id];
            }

            return res;
        });
    }

    ping () {
        return this.getCve('CVE-2017-17712');
    }
}();

'use strict';

const _ = require('lodash');
const assert = require('assert');
const URI = require('urijs');
const Connector = require('../Connector');
const cls = require('../../util/cls');

const { host, insecure } = require('../../config').rbac;
const metrics = require('../metrics');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.orgIdMetrics = metrics.createConnectorMetric(this.getName(), 'getTenantOrgIds');
        this.EBSAccountMetrics = metrics.createConnectorMetric(this.getName(), 'getEBSAccounts');
    }

    async getTenantOrgIds (accounts) {
        const uri = new URI(host);
        uri.path('/internal/orgIds');
        // uri.query({application: 'remediations'});

        const options = {
            uri: uri.toString(),
            method: 'POST',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders(false),
            body: [].concat(accounts)
        };

        if (_.isEmpty(accounts)) {
            return {};
        }

        try {
            const result = await this.doHttp (options, false, this.orgIdMetrics);

            if (_.isEmpty(result)) {
                return null;
            }

            return result;
        } catch (e) {
            log.warn({ error: e }, `Failed to retrieve tenant org_ids for accounts: ${accounts}`);
            throw e;
        }
    }

    async getEBSAccounts (tenant_org_ids) {
console.log(`fetching EBS Accounts for: ${tenant_org_ids}`);
        const uri = new URI(host);
        uri.path('/internal/ebsNumbers');
        // uri.query({application: 'remediations'});

        const options = {
            uri: uri.toString(),
            method: 'POST',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders(false),
            body: [].concat(tenant_org_ids)
        };
console.log(`options = ${options}`);
        if (_.isEmpty(tenant_org_ids)) {
console.log('no tenant_org_ids supplied - returning empty map');
            return {};
        }

        try {
            const result = await this.doHttp (options, false, this.orgIdMetrics);
console.log(`POST-ing request - response: ${result}`);

            if (_.isEmpty(result)) {
                return null;
            }

            return result;
        } catch (e) {
console.log(`caught exception: ${e}`);
            log.warn({ error: e }, `Failed to retrieve EBS_accounts for tenant org_ids: ${tenant_org_ids}`);
            throw e;
        }
    }

    async ping () {
        const req = cls.getReq();
        const result = await this.getEBSAccounts([`${req.identity.internal.org_id}`]);
        assert(result !== null);
    }
}();

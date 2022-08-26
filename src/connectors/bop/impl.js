'use strict';

const _ = require('lodash');
const assert = require('assert');
const URI = require('urijs');
const Connector = require('../Connector');
const log = require('../../util/log');
const cls = require('../../util/cls');

const { host, insecure } = require('../../config').bop;
const metrics = require('../metrics');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.orgIdMetrics = metrics.createConnectorMetric(this.getName(), 'getTenantOrgIds');
        this.EBSAccountMetrics = metrics.createConnectorMetric(this.getName(), 'getEBSAccounts');
    }

    // Given an array of account numbers, fetch corresponding tenant org_ids from
    // backoffice proxy
    async getTenantOrgIds (accounts) {
        log.info(`Fetching tenant_org_ids for accounts: ${accounts}`);

        const EBS_accounts = [].concat(accounts).map(String);

        if (_.isEmpty(EBS_accounts)) {
            log.info('No EBS accounts supplied - returning empty map');
            return {};
        }

        const uri = new URI(host);
        uri.path('/internal/orgIds');

        const options = {
            uri: uri.toString(),
            method: 'POST',
            json: true,
            rejectUnauthorized: !insecure,
            body: EBS_accounts
        };

        // if this function was called outside the context of a user request (e.g. from a db migration)
        // then skip the forwarded headers.
        if (cls.getReq()) {
            options.headers = this.getForwardedHeaders(false);
        }

        try {
            log.debug(`Request options: ${JSON.stringify(options)}`);
            const result = await this.doHttp (options, false, this.orgIdMetrics);
            log.debug(`POST response: ${JSON.stringify(result)}`);

            if (_.isEmpty(result)) {
                return {};
            }

            return result;
        } catch (e) {
            log.warn({ error: e }, `Failed to retrieve tenant org_ids for accounts: ${accounts}`);
            throw e;
        }
    }

    // Given an array of tenant org_ids, fetch corresponding EBS account numbers
    // from backoffice proxy
    async getEBSAccounts (org_ids) {
        log.info(`Fetching EBS Accounts for: ${org_ids}`);

        const tenant_org_ids = [].concat(org_ids).map(String);

        if (_.isEmpty(tenant_org_ids)) {
            log.info('No tenant_org_ids supplied - returning empty map');
            return {};
        }

        const uri = new URI(host);
        uri.path('/internal/ebsNumbers');

        const options = {
            uri: uri.toString(),
            method: 'POST',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders(false),
            body: tenant_org_ids
        };

        try {
            log.debug(`Request options: ${JSON.stringify(options)}`);
            const result = await this.doHttp (options, false, this.orgIdMetrics);
            log.debug(`POST response: ${JSON.stringify(result)}`);

            if (_.isEmpty(result)) {
                return {};
            }

            return result;
        } catch (e) {
            log.warn({ error: e }, `Failed to retrieve EBS_accounts for tenant org_ids: ${tenant_org_ids}`);
            throw e;
        }
    }

    // Verify connection to backoffice proxy tenant org_id / EBS account number translation service
    async ping () {
        const req = cls.getReq();
        const result = await this.getEBSAccounts([`${req.identity.internal.org_id}`]);
        assert(result !== null);
    }
}();

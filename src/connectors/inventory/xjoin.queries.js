'use strict';

const { GraphQLClient } = require('graphql-request');

const { xjoinHost } = require('../../config').inventory;
const { createIdentityHeader } = require('../../middleware/identity/utils');
const errors = require('../../errors');
const log = require('../../util/log');

const IDENTITY_HEADER = 'x-rh-identity';

exports.BATCH_DETAILS_QUERY = `
    query hosts (
        $filter: HostFilter,
        $order_by: HOSTS_ORDER_BY,
        $order_how: ORDER_DIR,
        $limit: Int,
        $offset: Int) {
        hosts (
            filter: $filter
            order_by: $order_by,
            order_how: $order_how,
            limit: $limit,
            offset: $offset
        )
        {
            data {
                id
                display_name
                facts
                canonical_facts (filter: ["fqdn"])
            }
        }
    }
`;

exports.BATCH_PROFILE_QUERY = `
    query hosts (
        $filter: HostFilter,
        $order_by: HOSTS_ORDER_BY,
        $order_how: ORDER_DIR,
        $limit: Int,
        $offset: Int) {
        hosts (
            filter: $filter
            order_by: $order_by,
            order_how: $order_how,
            limit: $limit,
            offset: $offset
        )
        {
            data {
                id
                system_profile_facts (filter: ["owner_id", "rhc_client_id", "is_marketplace"])
            }
        }
    }
`;

exports.INSIGHTS_ID_QUERY = `
    query hosts ($insights_id: String) {
        hosts (filter: {insights_id: {eq: $insights_id}})
        {
            data {
                id
                account
                canonical_facts (filter: ["insights_id", "fqdn"])
                display_name
                modified_on
            }
        }
    }
`;

exports.runQuery = async function (query, variables, headers = {[IDENTITY_HEADER]: createIdentityHeader()}, metrics = false) {
    try {
        const client = new GraphQLClient(xjoinHost, { headers });
        const before = new Date();

        metrics && metrics.miss.inc();
        return client.rawRequest(query, variables)
        .then(res => {
            metrics && metrics.duration.observe(new Date() - before);
            return res;
        });
    } catch (e) {
        log.trace(e, 'dependency error');
        metrics && metrics.error.inc();
        throw errors.internal.dependencyError(e, this);
    }
};

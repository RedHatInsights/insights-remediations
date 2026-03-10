'use strict';

const queries = require('./remediations.queries');
const inventory = require('../connectors/inventory');
const log = require('../util/log');
const { storeSystemDetails } = require('./controller.write');

/**
 * Fetches system details from local DB, with automatic backfill from Inventory.
 * 
 * NOTE: This backfill logic is transitional. Once old systems are backfilled through
 * normal usage (or become irrelevant), this helper can be simplified or removed since
 * new systems always get complete data via storeSystemDetails.
 * 
 * @param {string[]} ids - System UUIDs to fetch
 * @param {Object} options
 * @param {string} options.satOrgId - If provided, also backfill systems with null satellite_org_id
 * @param {string} options.ownerId - If provided, also backfill systems with null owner_id
 * @returns {Object} Systems keyed by ID
 */
async function getSystemsWithBackfill(ids, { satOrgId, ownerId } = {}) {
    if (!ids || ids.length === 0) {
        return {};
    }

    let systems = await queries.getSystemDetailsForPlaybook(ids);

    const needsBackfill = ids.filter(id => {
        const system = systems[id];
        if (!system) return true;
        if (satOrgId && system.satellite_org_id == null) return true;
        if (ownerId && system.owner_id == null) return true;
        return false;
    });

    if (needsBackfill.length > 0) {
        try {
            const inventoryData = await inventory.getSystemDetailsBatch(needsBackfill);
            storeSystemDetails(inventoryData).catch(err =>
                log.warn({ err }, 'Failed to store system details')
            );
            // Add Inventory data to results being returned
            needsBackfill.forEach(id => {
                if (inventoryData[id]) {
                    systems[id] = { ...systems[id], ...inventoryData[id] };
                }
            });
        } catch (err) {
            log.warn({ err, needsBackfill }, 'Failed to fetch systems from Inventory');
        }
    }

    return systems;
}

module.exports = { getSystemsWithBackfill };

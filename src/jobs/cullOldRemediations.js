'use strict';

const db = require('../db');
const log = require('../util/log');
const { Op } = require('sequelize');

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;
const DEFAULT_RETENTION_DAYS = 270; // 9 months
const DEFAULT_BATCH_SIZE = 1000;

function getCutoffDate(retentionDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    return cutoff;
}

async function cullOldRemediations() {
    const retentionDays = parseInt(process.env.REMEDIATION_RETENTION_DAYS, 10) || DEFAULT_RETENTION_DAYS;
    const batchSize = parseInt(process.env.REMEDIATION_CULL_BATCH_SIZE, 10) || DEFAULT_BATCH_SIZE;
    const cutoffDate = getCutoffDate(retentionDays);

    log.info({ retentionDays, batchSize, cutoffDate: cutoffDate.toISOString() }, 'Starting remediation culling job');

    let totalDeleted = 0;

    try {
        await db.connect();

        while (true) {
            const oldRemediations = await db.remediation.findAll({
                attributes: ['id'],
                where: { updated_at: { [Op.lt]: cutoffDate } },
                limit: batchSize,
                raw: true
            });

            if (oldRemediations.length === 0) break;

            const ids = oldRemediations.map(r => r.id);
            const deletedCount = await db.remediation.destroy({
                where: { id: { [Op.in]: ids } }
            });

            totalDeleted += deletedCount;
            log.info({ deletedInBatch: deletedCount, totalDeleted }, 'Deleted batch of old remediations');
        }

        log.info({ totalDeleted, retentionDays }, 'Remediation culling job completed');
        return totalDeleted;
    } finally {
        await db.close();
    }
}

async function main() {
    try {
        await cullOldRemediations();
        process.exit(EXIT_SUCCESS);
    } catch (error) {
        log.error({ error: error.message, stack: error.stack }, 'Culling job failed');
        process.exit(EXIT_FAILURE);
    }
}

module.exports = { cullOldRemediations, getCutoffDate, DEFAULT_BATCH_SIZE, DEFAULT_RETENTION_DAYS };

if (require.main === module) {
    main();
}

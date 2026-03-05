'use strict';

/**
 * Returns a default expiration_date for seed data: today + planRetentionDays.
 * Computed at seed time so remediation plans stay "not yet expired" whenever
 * tests run. Future culling jobs can test with explicitly past expiration_date
 * in dedicated seed data or fixtures.
 */
function getDefaultExpirationDate() {
    const config = require('../src/config');
    const d = new Date();
    d.setDate(d.getDate() + (config.planRetentionDays ?? 270));
    return d.toISOString().split('T')[0];
}

module.exports = { getDefaultExpirationDate };

'use strict';

/* eslint no-empty: off */

const fs = require('fs');
const { version } = require('../../package.json');
const config = require('../config');

function getCommit () {
    if (config.commit) {
        return String(config.commit);
    }

    try {
        return fs.readFileSync('commit.txt', 'utf-8').trim();
    } catch (ignored) {
    }
}

exports.version = version;

const commit = getCommit();

if (commit) {
    exports.commit = commit;
    exports.short = commit.substring(0, 7);
} else {
    exports.commit = exports.short = 'unknown';
}

exports.full = `InsightsRemediations/${exports.short}`;

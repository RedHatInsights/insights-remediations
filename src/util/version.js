'use strict';

/* eslint no-empty: off */

const fs = require('fs');
const { version } = require('../../package.json');
const { commit } = require('../config');

function getCommit () {
    if (commit) {
        return String(commit).substring(0, 7);
    }

    try {
        return fs.readFileSync('commit.txt', 'utf-8').trim();
    } catch (ignored) {
    }

    return 'unknown';
}

module.exports = {
    version,
    commit: getCommit()
};

module.exports.full = `InsightsRemediations/${module.exports.commit}`;

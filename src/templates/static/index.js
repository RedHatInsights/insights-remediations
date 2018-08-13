'use strict';

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const Template = require('../Template');

module.exports = Object.freeze(traverse(__dirname));

function traverse (dir) {
    const files = fs.readdirSync((dir), {encoding: 'utf8'});
    return _(files).keyBy(file => file.replace(/\.yml$/, '')).mapValues(file => {
        const isDirectory = fs.statSync(path.join(dir, file)).isDirectory();

        if (isDirectory) {
            return traverse(path.join(dir, file));
        }

        if (file.endsWith('yml')) {
            return new Template(fs.readFileSync(path.join(dir, file), 'utf8').trim());
        }
    }).pickBy().value();
}

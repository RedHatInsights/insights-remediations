'use strict';

const _ = require('lodash');

const PATTERN = /([\w]+)\s*=\s*([\w]+)/;

exports.parse = function (string) {
    const lines = string.split('\n');

    return _.transform(lines, function (result, line) {
        const match = PATTERN.exec(line);

        if (match) {
            result[match[1]] = parseValue(match[2]);
        }

        return result;
    }, {});
};

function parseValue (value) {
    const lower = value.toLowerCase();

    switch (lower) {
        case 'true': return true;
        case 'false': return false;
        default: return value;
    }
}

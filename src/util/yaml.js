'use strict';

const _ = require('lodash');

exports.isVariableUsed = function (variable, play) {
    const lines = play.split('\n');

    return _.some(lines, function (line) {
        return line.split('#')[0].includes(variable);
    });
};

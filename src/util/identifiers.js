'use strict';

const errors = require('../errors');
const PATTERN = /^(advisor|vulnerabilities|compliance|test):([\w\d-_|:\\.]+)$/;

function match (id) {
    const match = PATTERN.exec(id);
    if (!match) {
        throw errors.invalidIssueId(id);
    }

    return match;
}

exports.validate = match;

exports.parse = function (id) {
    const result = match(id);

    return {
        app: result[1],
        issue: result[2],
        full: id
    };
};

exports.toExternal = id => match(id)[2];

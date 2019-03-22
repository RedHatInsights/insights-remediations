'use strict';

const _ = require('lodash');

const DIRECTIVE_END_REGEX = /^---.*?\n/gm;
const DOCUMENT_END_REGEX = /\n\.\.\..*?$/gm;

exports.isVariableUsed = function (variable, play) {
    const lines = play.split('\n');

    return _.some(lines, function (line) {
        return line.split('#')[0].includes(variable);
    });
};

exports.removeDocumentMarkers = function (yaml) {
    yaml = yaml.replace(DIRECTIVE_END_REGEX, '');
    yaml = yaml.replace(DOCUMENT_END_REGEX, '');
    return yaml;
};

exports.sanitizeHost = function (host) {
    return host.replace(/[\n\r\s,]/g, '');
};

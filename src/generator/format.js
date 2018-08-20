'use strict';

const yaml = require('js-yaml');
const errors = require('../errors');

const DOCUMENT_PREFIX = '---\n';

exports.render = function (plays) {
    return DOCUMENT_PREFIX + plays.map(play => play.render()).join('\n\n');
};

exports.validate = function (playbook) {
    if (playbook.includes('@@')) {
        throw errors.internal.playbookValidationFailed(new Error('playbook not fully rendered'), playbook);
    }

    // crosscheck that what we generated is a valid yaml document
    let parsed;
    try {
        parsed = yaml.safeLoad(playbook);
    } catch (e) {
        throw errors.internal.playbookValidationFailed(e, playbook);
    }

    if (!Array.isArray(parsed)) {
        throw errors.internal.playbookValidationFailed(new Error('expected playbook to be an array of plays'), playbook);
    }

    return playbook;
};

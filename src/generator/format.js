'use strict';

const yaml = require('js-yaml');

const DOCUMENT_PREFIX = '---\n';

exports.render = function (plays) {
    return DOCUMENT_PREFIX + plays.map(play => play.render()).join('\n\n');
};

exports.validate = function (playbook) {
    if (playbook.includes('@@')) {
        throw new Error(`playbook not fully rendered: ${playbook}`);
    }

    // crosscheck that what we generated is a valid yaml document
    const parsed = yaml.safeLoad(playbook);

    if (!Array.isArray(parsed)) {
        throw new Error('expected playbook to be an array of plays');
    }

    // TODO: proper error handling
};

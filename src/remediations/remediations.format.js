'use strict';

const _ = require('lodash');

exports.list = function (remediations) {
    const formatted = _.map(remediations, remediation => _.pick(remediation, [
        'id',
        'name',
        'owner',
        'updated_at',
        'needsReboot',
        'systemCount',
        'issueCount'
    ]));

    return {
        remediations: formatted
    };
};

exports.get = function (remediation) {
    return _.pick(remediation, ['id', 'name', 'updated_at', 'owner', 'issues']);
};

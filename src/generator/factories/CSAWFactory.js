'use strict';

const _ = require('lodash');
const issues = require('../../issues');
const errors = require('../../errors');
const Factory = require('./Factory');

module.exports = class CVEFactory extends Factory {

    async createPlay (issue, strict = true) {
        const resolver = issues.getHandler(issue.id).getResolutionResolver();
        const play = await resolver.resolveResolutions(issue, strict);

        if (_.isEmpty(play)) {
            throw errors.unknownIssue(issue.id);
        }

        return play;
    }
};

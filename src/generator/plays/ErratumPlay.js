'use strict';

const ResolutionPlay = require('./ResolutionPlay');
const {notNil} = require('../../util/preconditions');

module.exports = class ErratumPlay extends ResolutionPlay {

    constructor (id, hosts, resolution, description) {
        super(id, hosts, resolution, description);
        this.erratum = notNil(id.issue);
        this.issueType = resolution.issueType;
    }

    getTemplateParameters () {
        const params = super.getTemplateParameters();
        params.ISSUES = this.erratum;
        return params;
    }
};

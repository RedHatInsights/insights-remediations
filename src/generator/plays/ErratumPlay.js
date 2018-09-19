'use strict';

const ResolutionPlay = require('./ResolutionPlay');
const {notNil, isBoolean} = require('../../util/preconditions');

module.exports = class ErratumPlay extends ResolutionPlay {

    constructor (id, hosts, resolution, description) {
        super(id, hosts, resolution, description);
        this.erratum = notNil(id.issue);
        this.isAdvisory = isBoolean(resolution.isAdvisory);
    }

    getTemplateParameters () {
        const params = super.getTemplateParameters();
        params.ISSUES = this.erratum;
        return params;
    }
};

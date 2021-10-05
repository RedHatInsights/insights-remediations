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
        switch (this.issueType) {
            case 'erratum':
                params.ISSUES = '--advisory ' + this.erratum;
                break;
            case 'cve':
                params.ISSUES = '--cve ' + this.erratum;
                break;
            default:
                params.ISSUES = this.erratum;
        }

        return params;
    }
};

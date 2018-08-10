'use strict';

const RemediationPlay = require('./RemediationPlay');
const {notNil} = require('../util/preconditions');

module.exports = class ErratumPlay extends RemediationPlay {

    constructor (id, template, hosts, description) {
        super(id, template, hosts, description);
        this.erratum = notNil(id.issue);
    }

    getTemplateParameters () {
        const params = super.getTemplateParameters();
        params.ERRATA = this.erratum;
        return params;
    }
};

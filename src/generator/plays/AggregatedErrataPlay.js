'use strict';

const _ = require('lodash');
const Play = require('./Play');
const {nonEmptyArray} = require('../../util/preconditions');
const ERRATA_TEMPLATE = require('../../templates/static').vulnerabilities.errata;
const CVES_TEMPLATE = require('../../templates/static').vulnerabilities.cves;
const HEADER_TEMPLATE = require('../../templates/static').special.headerMulti;

module.exports = class MergedPlay extends Play {

    constructor (plays) {
        nonEmptyArray(plays);
        super(plays[0].id, plays[0].hosts);
        this.plays = _.sortBy(plays, 'erratum');
        this.issues = _.map(this.plays, 'erratum');
        this.template = plays[0].isAdvisory ? ERRATA_TEMPLATE : CVES_TEMPLATE;
    }

    generateHeader () {
        return HEADER_TEMPLATE.render({
            plays: this.plays,
            description: this.description,
            identifier: `${this.plays.map(play => play.id.full).join()},fix`,
            version: `${this.version || 'unknown'}`
        });
    }

    getTemplateParameters () {
        const params = super.getTemplateParameters();
        params.ISSUES = this.issues;
        return params;
    }

    render () {
        const header = this.generateHeader();
        const body = this.template.render(this.getTemplateParameters());
        return [header, body].join('\n');
    }

    needsReboot () {
        return _.some(this.plays, play => play.needsReboot());
    }
};

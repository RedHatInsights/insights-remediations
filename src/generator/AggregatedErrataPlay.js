'use strict';

const _ = require('lodash');
const Play = require('./Play');
const {nonEmptyArray} = require('../util/preconditions');
const TEMPLATE = require('../templates/static').vulnerabilities.errata;
const HEADER_TEMPLATE = require('../templates/static').special.headerMulti;

module.exports = class MergedPlay extends Play {

    constructor (plays) {
        nonEmptyArray(plays);
        super(plays[0].id, plays[0].hosts);
        this.plays = plays;
        this.errata = plays.map(play => play.erratum);
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
        params.ERRATA = this.errata;
        return params;
    }

    render () {
        const header = this.generateHeader();
        const body = TEMPLATE.render(this.getTemplateParameters());
        return [header, body].join('\n');
    }

    needsReboot () {
        return _.some(this.plays, play => play.needsReboot());
    }
};

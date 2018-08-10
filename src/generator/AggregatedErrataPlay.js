'use strict';

const Play = require('./Play');
const {nonEmptyArray} = require('../util/preconditions');

module.exports = class MergedPlay extends Play {

    constructor (plays) {
        nonEmptyArray(plays);
        super(plays[0].id, plays[0].template, plays[0].hosts);
        this.plays = plays;
        this.errata = plays.map(play => play.erratum);
    }

    generateHeader () {
        const header = [
            `# Upgrade packages to apply the following errata:`,
            ...this.plays.map(play => `#   - ${play.description}`),
            `# Identifier: (${this.plays.map(play => play.id.full).join()},fix)`,
            `# Version: ${this.version || 'unknown'}`
        ];

        return header.join('\n');
    }

    getTemplateParameters () {
        const params = super.getTemplateParameters();
        params.ERRATA = this.errata;
        return params;
    }

    render () {
        const header = this.generateHeader();
        const body = this.template.render(this.getTemplateParameters());
        return [header, body].join('\n');
    }
};

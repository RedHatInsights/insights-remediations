'use strict';

const i = require('dedent-js');
const Play = require('./Play');

module.exports = class RemediationPlay extends Play {

    constructor (id, template, hosts, description = `Fixes ${id.full}`) {
        super(id, template, hosts);
        this.description = description;
    }

    generateHeader () {
        return i`
            # ${this.description}
            # Identifier: (${this.id.full},${this.template.resolutionType})
            # Version: ${this.version || 'unknown'}`;
    }

    render () {
        const header = this.generateHeader();
        const body = this.template.render(this.getTemplateParameters());
        return [header, body].join('\n');
    }
};

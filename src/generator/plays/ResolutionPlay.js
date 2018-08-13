'use strict';

const Play = require('./Play');
const {notNil} = require('../../util/preconditions');
const HEADER_TEMPLATE = require('../../templates/static').special.headerSimple;

module.exports = class RemediationPlay extends Play {

    constructor (id, hosts, resolution, description = `Fixes ${id.full}`) {
        super(id, hosts);
        this.resolution = notNil(resolution);
        this.description = description;
    }

    generateHeader () {
        return HEADER_TEMPLATE.render({
            description: this.description,
            identifier: `${this.id.full},${this.resolution.type}`,
            version: `${this.version || 'unknown'}`
        });
    }

    render () {
        const header = this.generateHeader();
        const body = this.resolution.render(this.getTemplateParameters());
        return [header, body].join('\n');
    }

    needsReboot () {
        return this.resolution.needsReboot;
    }

    needsDiagnosis () {
        return this.resolution.needsDiagnosis;
    }
};

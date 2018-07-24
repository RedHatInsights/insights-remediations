'use strict';

const mustache = require('mustache');

const TAG = '@@';
const HOSTS_PLACEHOLDER = `${TAG}HOSTS${TAG}`;
mustache.tags = [TAG, TAG];

module.exports = class Template {

    constructor (template, needsReboot = false, needsPydata = false, parameters = {}) {
        if (!template.includes(HOSTS_PLACEHOLDER)) {
            throw new Error (`Template does not include {HOSTS_PLACEHOLDER}: ${template}`);
        }

        this.template = template;
        this.needsReboot = needsReboot;
        this.needsPydata = needsPydata;
        this.parameters = parameters;
    }

    render (systems) {
        if (!Array.isArray(systems) || !systems.length) {
            throw new Error(`unexpected systems: ${systems}`);
        }

        return mustache.render(this.template, {
            HOSTS: systems.join(),
            ...this.parameters
        });
    }

    /*
     * Returns a new template object with the given parameters stored.
     */
    apply(parameters) {
        return new Template(this.template, this.needsReboot, this.needsPydata, {
            ...this.parameters,
            ...parameters
        });
    }
};

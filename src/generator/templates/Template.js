'use strict';

const mustache = require('mustache');

const TAG = '@@';
const HOSTS_PLACEHOLDER = `${TAG}HOSTS${TAG}`;
mustache.tags = [TAG, TAG];

module.exports = class Template {

    constructor (template, needsReboot = false, needsPydata = false) {
        if (!template.includes(HOSTS_PLACEHOLDER)) {
            throw new Error (`Template does not include {HOSTS_PLACEHOLDER}: ${template}`);
        }

        this.template = template;
        this.needsReboot = needsReboot;
        this.needsPydata = needsPydata;
    }

    render (systems) {
        // TODO validate at least one

        return mustache.render(this.template, {
            HOSTS: systems.join()
        });
    }
};

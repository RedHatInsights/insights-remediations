'use strict';

const mustache = require('mustache');
const {notNil} = require('../../util/preconditions');

const TAG = '@@';
const HOSTS_PLACEHOLDER = `${TAG}HOSTS${TAG}`;
mustache.tags = [TAG, TAG];

module.exports = class Template {

    constructor (template, resolutionType = 'fix', needsReboot = false, needsDiagnosis = false, parameters = {}) {
        if (!template.includes(HOSTS_PLACEHOLDER)) {
            throw new Error (`Template does not include ${HOSTS_PLACEHOLDER}: ${template}`);
        }

        this.template = notNil(template);
        this.resolutionType = resolutionType;
        this.needsReboot = needsReboot;
        this.needsDiagnosis = needsDiagnosis;
        this.parameters = parameters;
    }

    render (parameters) {
        return mustache.render(this.template, {
            ...parameters,
            ...this.parameters
        });
    }

    /*
     * Returns a new template object with the given parameters stored.
     */
    apply(parameters) {
        return new Template(this.template, this.resolutionType, this.needsReboot, this.needsDiagnosis, {
            ...this.parameters,
            ...parameters
        });
    }
};

module.exports.HOSTS_PLACEHOLDER = HOSTS_PLACEHOLDER;

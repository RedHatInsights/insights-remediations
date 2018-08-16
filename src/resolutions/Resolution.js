'use strict';

const Template = require('../templates/Template');

function createTemplate (template) {
    if (typeof template === 'string') {
        return new Template(template);
    }

    if (template instanceof Template) {
        return template;
    }

    throw new Error(`Invalid template type ${typeof template}`);
}

module.exports = class Resolution {

    constructor (template, type = 'fix', description, needsReboot = false, needsDiagnosis = false, riskOfChange = -1) {
        this.template = createTemplate(template);
        this.type = type;
        this.needsReboot = needsReboot;
        this.needsDiagnosis = needsDiagnosis;
        this.description = description;
        this.riskOfChange = riskOfChange;

        if (!this.template.data.includes(Template.HOSTS_PLACEHOLDER)) {
            throw new Error (`Template does not include ${Template.HOSTS_PLACEHOLDER}: ${this.template.data}`);
        }
    }

    render (parameters) {
        return this.template.render(parameters);
    }
};

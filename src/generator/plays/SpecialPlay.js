'use strict';

const Play = require('./Play');

module.exports = class SpecialPlay extends Play {

    constructor (id, hosts, template) {
        super(id, hosts);
        this.template = template;
    }

    render () {
        return this.template.render(this.getTemplateParameters());
    }
};

'use strict';

const Play = require('./Play');
const _ = require('lodash');

module.exports = class SpecialPlay extends Play {

    constructor (id, hosts, template, extraParameters = {}) {
        super(id, hosts);
        this.template = template;
        this.extraParameters = extraParameters;
    }

    render () {
        const params = _.assign(this.getTemplateParameters(), this.extraParameters);
        return this.template.render(params);
    }
};

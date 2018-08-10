'use strict';

const {notNil, nonEmptyArray} = require('../util/preconditions');

module.exports = class Play {

    constructor (id, template, hosts) {
        this.id = notNil(id);
        this.template = notNil(template);
        this.hosts = nonEmptyArray(hosts);
    }

    getTemplateParameters () {
        return {
            HOSTS: this.hosts.join()
        };
    }

    render () {
        return this.template.render(this.getTemplateParameters());
    }
};

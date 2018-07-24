'use strict';

module.exports = class Play {

    constructor (id, template, hosts) {
        this.id = id;
        this.template = template;
        this.hosts = hosts;
    }

    render () {
        return this.template.render(this.hosts);
    }
};

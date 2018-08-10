'use strict';

const {notNil} = require('../util/preconditions');

module.exports = class Play {

    constructor (id, template, hosts) {
        this.id = notNil(id);
        this.template = notNil(template);
        this.hosts = notNil(hosts);
    }

    render () {
        return this.template.render(this.hosts);
    }
};

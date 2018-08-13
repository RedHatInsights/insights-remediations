'use strict';

const {notNil, nonEmptyArray} = require('../../util/preconditions');

module.exports = class Play {

    constructor (id, hosts) {
        this.id = notNil(id);
        this.hosts = nonEmptyArray(hosts);
    }

    getTemplateParameters () {
        return {
            HOSTS: this.hosts.join()
        };
    }

    render () {
        throw new Error('not implemented');
    }

    needsReboot () {
        return false;
    }

    needsDiagnosis () {
        return false;
    }
};

'use strict';

const _ = require('lodash');
const {notNil, nonEmptyArray} = require('../../util/preconditions');
const {sanitizeHost} = require('../../util/yaml');

module.exports = class Play {

    constructor (id, hosts) {
        this.id = notNil(id);
        this.hosts = _.sortBy(nonEmptyArray(hosts));
    }

    getTemplateParameters () {
        return {
            HOSTS: this.hosts.map(sanitizeHost).join()
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

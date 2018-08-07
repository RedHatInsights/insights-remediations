'use strict';

const _ = require('lodash');
const vmaas = require('../../external/vmaas');

const TEMPLATE = require('../templates').vulnerabilities.errata;
const identifiers = require('../../util/identifiers');
const APP = 'vulnerabilities';
const MATCH = /^RH[SBE]A-20[\d]{2}:[\d]{4,5}$/;

exports.resolveTemplates = async function (ids) {
    const filtered = ids.map(identifiers.parse).filter(id => id.app === APP && MATCH.test(id.issue));

    if (!filtered.length) {
        return {};
    }

    const errata = await vmaas.getErrata(filtered.map(id => id.issue));

    return _(filtered)
    .keyBy(id => id.full)
    .mapValues(id => {
        const erratum = errata[id.issue];

        if (erratum) {
            return [TEMPLATE.apply({ERRATA: id.issue})];
        }
    })
    .pickBy()
    .value();
};

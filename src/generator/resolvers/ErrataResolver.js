'use strict';

const _ = require('lodash');
const vmaas = require('../../external/vmaas');

const TEMPLATE = require('../templates').vulnerabilities.errata;
const PREFIX = 'vulnerabilities:';
const MATCH = /^vulnerabilities:RHSA-20[\d]{2}:[\d]{4,5}$/;

exports.resolveTemplates = async function (ids) {
    const filtered = ids.filter(id => MATCH.test(id));

    if (!filtered.length) {
        return {};
    }

    const errata = await vmaas.getErrata(ids.map(toErratumId));

    return _(errata)
    .mapValues((value, key) => ([TEMPLATE.apply({ERRATA: key})]))
    .mapKeys((value, key) => fromErratumId(key))
    .value();
};

function toErratumId (id) {
    return id.replace(PREFIX, '');
}

function fromErratumId (id) {
    return `${PREFIX}${id}`;
}

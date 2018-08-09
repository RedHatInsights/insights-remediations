'use strict';

const Play = require('../Play');
const ssgResolver = require('../templates/resolvers/SSGResolver');

exports.application = 'compliance';

exports.createPlay = async function ({id, hosts}) {
    const template = await ssgResolver.resolveTemplate(id);

    // TODO get metadata

    if (template) {
        return new Play(id, template, hosts);
    }
};


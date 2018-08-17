'use strict';

exports.getRule = async function (id) {
    return {
        id,
        description: `OpenSCAP fix for ${id}`
    };
};


'use strict';

exports.getRule = async function (id) {
    return {
        id,
        description: `Problem known as ${id}`
    };
};


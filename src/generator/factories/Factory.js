'use strict';

const disambiguator = require('../../resolutions/disambiguator');

module.exports = class Factory {

    createPlay () {
        throw new Error('not implemented');
    }

    disambiguate (resolutions, resolution, id, strict, req) {
        return disambiguator.disambiguate(resolutions, resolution, id, strict, true, req);
    }
};

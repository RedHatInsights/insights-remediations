'use strict';

const disambiguator = require('../disambiguator');

module.exports = class Resolver {

    /**
     * Returns an array of Resolution object for the given issue identifier or an empty array of no resolutions are available.
     */
    resolveResolutions () {
        throw new Error('not implemented');
    }

    async isRebootNeeded (id, resolutionId) {
        const resolutions = await this.resolveResolutions(id);
        const resolution = disambiguator.disambiguate(resolutions, resolutionId, id, false, false);

        if (resolution) {
            return resolution.needsReboot;
        }

        return null;
    }
};

'use strict';

const URI = require('urijs');
const P = require('bluebird');

const config = require('../../config');
const request = require('../../util/request');

exports.getResolutions = async function (id, includePlay = false) {

    let resolutions = await getResolutions(id);

    if (includePlay) {
        resolutions = P.map(resolutions, async resolution => {
            const { play } = await getResolutionDetails(id, resolution.resolution_type);
            resolution.play = play;
            return resolution;
        });
    }

    return resolutions;
};

function contentServerRequest (uri) {
    return request({
        uri,
        method: 'GET',
        json: true,
        rejectUnauthorized: !config.contentServer.insecure,
        headers: {
            Authorization: config.contentServer.auth
        }
    });
}

function getResolutions (id) {
    const uri = new URI(config.contentServer.host);
    uri.path('/r/insights/v3/rules/');
    uri.segment(id);
    uri.segment('ansible-resolutions');
    uri.segment('105');

    return contentServerRequest(uri.toString());
}

function getResolutionDetails (id, resolution) {
    const uri = new URI(config.contentServer.host);
    uri.path('/r/insights/v3/rules/');
    uri.segment(id);
    uri.segment('ansible-resolutions');
    uri.segment('105');
    uri.segment(resolution);

    return contentServerRequest(uri.toString());
}

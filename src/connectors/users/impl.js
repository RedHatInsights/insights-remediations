'use strict';

const request = require('../http');
const URI = require('urijs');
const _ = require('lodash');
const {host, insecure, auth, env} = require('../../config').users;
const assert = require('assert');

exports.getUsers = async function (ids = []) {
    assert(Array.isArray(ids));

    if (!ids.length) {
        return {};
    }

    const uri = new URI(host);
    uri.path('/v1/users');

    const result = await request({
        uri: uri.toString(),
        method: 'POST',
        json: true,
        rejectUnauthorized: !insecure,
        headers: {
            'x-rh-apitoken': auth,
            'x-rh-insights-env': env
        },
        body: {
            users: ids
        }
    }, true);

    return _.keyBy(result, 'username');
};

exports.ping = async function () {
    const result = await exports.getUsers(['***REMOVED***']);
    assert(result['***REMOVED***'].username === '***REMOVED***');
};

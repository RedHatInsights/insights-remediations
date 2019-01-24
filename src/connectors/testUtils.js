'use strict';

const base = require('../test');
const Connector = require('./Connector');

exports.mockHeaders = function (headers = {
    'x-rh-identity': 'identity',
    'x-rh-insights-request-id': 'request-id'
}) {
    base.getSandbox().stub(Connector.prototype, 'getForwardedHeaders').returns(headers);
    return headers;
};

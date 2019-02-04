'use strict';

const base = require('../test');
const cls = require('../util/cls');

exports.mockRequest = function (headers = {
    'x-rh-identity': 'identity',
    'x-rh-insights-request-id': 'request-id'
}) {
    base.getSandbox().stub(cls, 'getReq').returns({
        headers
    });
};

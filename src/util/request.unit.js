'use strict';

const P = require('bluebird');
const base = require('../test');
const request = require('./request');
const version = require('../version/version.controller');
const config = require('../config');

const REQ = {
    headers: {
        'x-rh-identity': 'identity',
        'x-rh-insights-request-id': 'request-id'
    },
    identity: { type: 'test' },
    user: { username: 'test', account_number: 'test' }
};

// stub getVersions for the request to take at least 50ms
beforeEach(() => base.sandbox.stub(version, 'get').callsFake((req, res) => P.delay(50).then(() => res.end())));

test('includes request options in the error object', async function () {

    const options = {
        url: `http://localhost:9003${config.path.base}/v1/version`,
        timeout: 20
    };

    try {
        await request.run(options);
        throw new Error('not thrown!');
    } catch (e) {
        // the exact error code varies between these two values randomly
        // https://github.com/request/request/issues/2320
        e.should.have.property('error');
        ['ESOCKETTIMEDOUT', 'ETIMEDOUT'].includes(e.error.code).should.be.true();
        e.should.have.property('options', options);
    }
});

test('includes request options in the error object of a request child', async function () {
    const options = {
        url: `http://localhost:9003${config.path.base}/v1/version`
    };

    const req = request.run.defaults({ timeout: 20 });

    try {
        await req(options);
        throw new Error('not thrown!');
    } catch (e) {
        // the exact error code varies between these two values randomly
        // https://github.com/request/request/issues/2320
        e.should.have.property('error');
        ['ESOCKETTIMEDOUT', 'ETIMEDOUT'].includes(e.error.code).should.be.true();
        e.should.have.property('options', options);
    }
});

test('unwraps request if needed', function () {
    request.run.unwrap().should.not.be.null();
});

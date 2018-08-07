'use strict';

const P = require('bluebird');
const base = require('../test');
const request = require('./request');
const version = require('../version/version.controller');

// stub getVersions for the request to take at least 50ms
beforeEach(() => base.sandbox.stub(version, 'get').callsFake((req, res) => P.delay(50).then(() => res.end())));

test('includes request options in the error object', async function () {

    const options = {
        url: `http://localhost:9003/v1/version`,
        timeout: 20
    };

    try {
        await request(options);
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
        url: `http://localhost:9003/v1/version`
    };

    const req = request.defaults({ timeout: 20 });

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
    request.unwrap().should.not.be.null();
});

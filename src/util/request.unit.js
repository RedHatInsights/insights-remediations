'use strict';

require('../test');
const request = require('./request');

test('includes request options in the error object', async function () {
    const options = {
        url: `http://localhost:9003/health`,
        timeout: 1
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
        url: `http://localhost:9003/health`
    };

    const req = request.defaults({ timeout: 1 });

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

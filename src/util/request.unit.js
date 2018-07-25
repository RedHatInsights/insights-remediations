'use strict';

require('../test');
const request = require('./request');

test('includes request options in the error object', async function () {
    const options = {
        url: `http://localhost:9003`,
        timeout: 1
    };

    try {
        await request(options);
        throw new Error('not thrown!');
    } catch (e) {
        // the exact error code varies between these two values randomly
        // https://github.com/request/request/issues/2320
        ['ESOCKETTIMEDOUT', 'ETIMEDOUT'].includes(e.error.code).should.be.true();
        e.should.have.property('options', options);
    }
});

test('unwraps request if needed', function () {
    request.unwrap().should.not.be.null();
});

'use strict';

require('../test');
const P = require('bluebird');
const {compose, composeAsync, runAllSeq} = require('./fn');

test('compose()', () => {
    const a = value => [...value, 'a'];
    const b = value => [...value, 'b'];
    const c = value => [...value, 'c'];

    const pipeline = compose(a, b, c);
    pipeline([]).join('').should.equal('abc');
});

test('composeAsync()', async () => {
    const a = async value => [...value, 'a'];
    const b = value => P.delay(50).thenReturn([...value, 'b']);
    const c = value => [...value, 'c'];

    const pipeline = composeAsync(a, b, c);
    (await pipeline([])).join('').should.equal('abc');
});

test('runAllSync', async () => {
    let i = 0;

    const result = await runAllSeq(
        () => {
            throw new Error('0');
        },
        () => P.reject(new Error('1')),
        () => P.reject(new Error('2')),
        () => i++
    );

    i.should.equal(1);
    result.should.have.length(3);
    result[0].should.have.property('message', '0');
    result[1].should.have.property('message', '1');
    result[2].should.have.property('message', '2');
});

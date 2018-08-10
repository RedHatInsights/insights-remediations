'use strict';

require('../test');
const P = require('bluebird');
const {compose, composeAsync} = require('./fn');

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


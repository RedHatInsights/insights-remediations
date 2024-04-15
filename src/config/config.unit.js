'use strict';

const path = require('path');

describe('Configuration', () => {
    test('Verify app-common-js function', () => {
        process.env.ACG_CONFIG = path.resolve('src/config/test.json');
        const config = require('.');

        expect(config).toMatchSnapshot();
    });
});
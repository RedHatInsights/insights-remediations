'use strict';

require('../test');
const i = require('dedent-js');
const parser = require('./keyValueParser');

test('parses a string line', () => {
    parser.parse('strategy = restrict').should.eql({
        strategy: 'restrict'
    });
});

test('parses a boolean line', () => {
    parser.parse('reboot = false').should.eql({
        reboot: false
    });
});

test('parses multiple lines', () => {
    parser.parse(i`
        # platform = multi_platform_all
        # reboot = false
        # strategy = restrict
        # complexity = low
        # disruption = low`)
    .should.eql({
        platform: 'multi_platform_all',
        reboot: false,
        strategy: 'restrict',
        complexity: 'low',
        disruption: 'low'
    });
});

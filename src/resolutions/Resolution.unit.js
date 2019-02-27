'use strict';

const templates = require('../templates/static');
const errors = require('../errors');
const Resolution = require('./Resolution');

describe('resolution validation', function () {
    test('throws exception when HOSTS placeholder missing', function () {
        expect(() => new Resolution(templates.test.missingHosts)).toThrow(errors.InternalError);
    });
});

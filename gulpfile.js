'use strict';

const { series, src, dest, parallel } = require('gulp');
const { rm } = require('fs/promises');

const clean = async () => {
    return rm('./dist', {force: true, recursive: true});
};

const prod_image_files = [
    'package.json',
    'package-lock.json',
    'src/**/*.js',
    'src/**/*.yaml',
    'src/**/*.yml',
    'src/**/noop.js',
    'certs/**/*',
    'db/**/*',
    '.sequelizerc',
    '.npmrc',
];
const test_image_files = [
    'src/**/__snapshots__/*',
    'src/**/mock.js',
    'src/**/serviceMock.js',
    'src/**/*.unit.js',
    'src/**/*.unit.data.js',
    'src/**/*.integration.js',
    'src/**/*.contract.js',
    'src/api/lint.js',
    'src/config/test.js',
    'src/config/test.json',
    'src/connectors/inventory/systemGenerator.js',
    'src/connectors/inventory/inventory_GET.json',
    'src/connectors/ssg/mock/**',
    'src/connectors/testUtils.js',
    'src/test/**',
    'jest.config.js'
];

const build_prod = () => {
    return src(prod_image_files, {base: './', ignore: test_image_files}).pipe(dest('./dist'));
};

const build_test = () => {
    return src(test_image_files, {base: './'}).pipe(dest('./test'));
};

exports.build = series(clean, parallel(build_prod, build_test));
exports.clean = clean;
exports.default = exports.build;
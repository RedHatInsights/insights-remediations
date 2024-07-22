'use strict';

module.exports = {
    coverageDirectory: 'artifacts/coverage',
    testEnvironment: 'node',
    roots: ['src'],
    reporters: ['default', ['jest-junit', {outputDirectory: 'artifacts', outputName: 'junit-remediations.xml'}]],
    testMatch: ['**/?(*.)+(unit|integration).js']
};

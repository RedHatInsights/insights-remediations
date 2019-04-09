'use strict';

const fs = require('fs');
const path = require('path');
const jsyaml = require('js-yaml');
const config = require('../config');

const OpenAPISchemaValidator = require('openapi-schema-validator').default;

const specPath = path.join(__dirname, './openapi.yaml');
// eslint-disable-next-line security/detect-non-literal-fs-filename
const spec = jsyaml.safeLoad(fs.readFileSync(specPath, 'utf8'));

const validator = new OpenAPISchemaValidator({ version: 3 });
const result = validator.validate(spec);

if (result.errors.length) {
    throw new Error(JSON.stringify(result.errors, null, 4));
}

if (config.env === 'development') {
    spec.servers.reverse(); // in DEV make the local server the default
}

module.exports = { spec, specPath };

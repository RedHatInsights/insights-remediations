'use strict';

const fs = require('fs');
const path = require('path');
const jsyaml = require('js-yaml');

const OpenAPISchemaValidator = require('openapi-schema-validator').default;

const specPath = path.join(__dirname, './openapi.yaml');
const spec = jsyaml.safeLoad(fs.readFileSync(specPath, 'utf8'));

const validator = new OpenAPISchemaValidator({ version: 3 });
const result = validator.validate(spec);

if (result.errors.length) {
    throw new Error(JSON.stringify(result.errors, null, 4));
}

module.exports = { spec, specPath };

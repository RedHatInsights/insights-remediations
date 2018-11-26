'use strict';

const fs = require('fs');
const path = require('path');
const jsyaml = require('js-yaml');
const _ = require('lodash');

const spec = jsyaml.safeLoad(fs.readFileSync(path.join(__dirname, 'src', 'api', './swagger.yaml'), 'utf8'));
let code = 0;

function checkNoAdditionalPropsAllowed (ref, path) {
    if (typeof ref !== 'object') {
        return;
    }

    if (_.has(ref, 'properties') && ref.additionalProperties !== false) {
        /* eslint no-console: off */
        console.error(`ERROR: "additionalProperties: false" missing in ${path.join('-->')}`);
        code = 1;
    }

    Object.keys(ref).forEach(key => checkNoAdditionalPropsAllowed(ref[key], [...path, key]));
}

checkNoAdditionalPropsAllowed(spec, []);
/* eslint no-process-exit: off */
process.exit(code);

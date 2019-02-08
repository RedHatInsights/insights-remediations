'use strict';

const _ = require('lodash');

const spec = require('./openapi').spec;

let code = 0;

// validates that every object type has additionalProperties and required attributes set
function checkPropsStrict (ref, path) {
    if (typeof ref !== 'object' || ref === null) {
        return;
    }

    if (_.has(ref, 'properties') && ref.additionalProperties !== false) {
        /* eslint no-console: off */
        console.error(`ERROR: "additionalProperties: false" missing in ${path.join('-->')}`);
        code = 1;
    }

    if (_.has(ref, 'properties') && !_.has(ref, 'required') && ref['x-remediations-strict'] !== false) {
        /* eslint no-console: off */
        console.error(`ERROR: "required" missing in ${path.join('-->')}`);
        code = 1;
    }

    Object.keys(ref).forEach(key => checkPropsStrict(ref[key], [...path, key]));
}

checkPropsStrict(spec, []);
/* eslint no-process-exit: off */
process.exit(code);

'use strict';

// OpenAPI 2.0 does not allow nullable types
// This wrapper replaces null with an empty string
exports.emptyStringOnNull = value => value === null ? '' : value;

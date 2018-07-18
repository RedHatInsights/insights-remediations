'use strict';

const fs = require('fs');
const path = require('path');
const P = require('bluebird');

const swaggerTools = require('swagger-tools');
const jsyaml = require('js-yaml');

const spec = jsyaml.safeLoad(fs.readFileSync(path.join(__dirname, './swagger.yaml'), 'utf8'));

module.exports = async function (app) {

    const mw = await P.fromCallback(cb => swaggerTools.initializeMiddleware(spec, mw => cb(null, mw)));

    app.use(mw.swaggerMetadata());
    app.use(mw.swaggerValidator({
        validateResponse: true
    }));
    app.use(mw.swaggerUi());
};

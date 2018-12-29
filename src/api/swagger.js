'use strict';

const fs = require('fs');
const path = require('path');
const P = require('bluebird');
const cls = require('../util/cls');

const swaggerTools = require('swagger-tools');
const jsyaml = require('js-yaml');

const spec = jsyaml.safeLoad(fs.readFileSync(path.join(__dirname, './swagger.yaml'), 'utf8'));

module.exports = async function (app, prefix) {

    const mw = await P.fromCallback(cb => swaggerTools.initializeMiddleware(spec, mw => cb(null, mw)));

    app.use(cls.patchMiddleware(mw.swaggerMetadata()));
    app.use(mw.swaggerValidator({
        validateResponse: true
    }));

    app.use(mw.swaggerUi({
        apiDocs: `${prefix}/v1/swagger.json`,
        swaggerUi: `${prefix}/v1/docs`
    }));
};

'use strict';

const { request } = require('../test');

describe('docs', function () {
    test('JSON', async function () {
        const {body} = await request
        .get('/v1/openapi.json')
        .expect(200);

        body.should.not.be.empty();
    });

    test('YAML', async function () {
        const {headers} = await request
        .get('/v1/openapi.yaml')
        .expect(200);

        headers['content-type'].should.eql('text/yaml; charset=UTF-8');
    });

    test('UI', async function () {
        const {headers} = await request
        .get('/v1/docs/')
        .expect(200);

        headers['content-type'].should.eql('text/html; charset=utf-8');
    });
});


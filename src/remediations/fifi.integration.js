'use strict';

const { request, auth } = require('../test');
const utils = require('../middleware/identity/utils');

describe('FiFi', function () {
    describe('connection status', function () {
        test('obtains connection status', async () => {
            const {text} = await request
            .get('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/connection_status?pretty')
            .set(auth.fifi)
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('404s on empty playbook', async () => {
            const {body} = await request
            .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f6927/connection_status?pretty')
            .set(auth.fifi)
            .expect(200);

            body.meta.count.should.eql(0);
            body.meta.total.should.eql(0);
            body.data.should.eql([]);
        });

        test('400 get connection status', async () => {
            await request
            .set(auth.fifi)
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d150000/connection_status')
            .expect(400);
        });

        test('get connection status with false smartManagement', async () => {
            await request
            .get('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/connection_status')
            .set(utils.IDENTITY_HEADER, utils.createIdentityHeader('fifi', 'fifi', true, data => {
                data.entitlements.smart_management = false;
                return data;
            }))
            .expect(403);
        });

        test('sets ETag', async () => {
            const {headers} = await request
            .get('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/connection_status?pretty')
            .set(auth.fifi)
            .expect(200);

            headers.etag.should.equal('"1062-Pl88DazTBuJo//SQVNUn6pZAllk"');
        });

        test('304s on ETag match', async () => {
            await request
            .get('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/connection_status?pretty')
            .set(auth.fifi)
            .set('if-none-match', '"1062-Pl88DazTBuJo//SQVNUn6pZAllk"')
            .expect(304);
        });
    });

    describe('playbook run', function () {
        test('execute playbook run', async () => {
            await request
            .post('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/playbook_runs')
            .set(auth.fifi)
            .expect(204);
        });

        test('execute playbook run with false smartManagement', async () => {
            await request
            .post('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/playbook_runs')
            .set(utils.IDENTITY_HEADER, utils.createIdentityHeader('fifi', 'fifi', true, data => {
                data.entitlements.smart_management = false;
                return data;
            }))
            .expect(403);
        });
    });
});

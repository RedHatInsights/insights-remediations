'use strict';

const { request, auth, mockDate, mockPlaybookRunId } = require('../test');
const utils = require('../middleware/identity/utils');
const receptor = require('../connectors/receptor');
const fifi = require('../remediations/fifi');
const base = require('../test');
const errors = require('../errors');

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
            .set('if-match', '"1062-Pl88DazTBuJo//SQVNUn6pZAllk"')
            .expect(201);
        });

        test('400 post playbook run', async () => {
            await request
            .set(auth.fifi)
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d150000/connection_status')
            .expect(400);
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

        test('sets ETag', async () => {
            const {headers} = await request
            .post('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/playbook_runs?pretty')
            .set(auth.fifi)
            .set('if-match', '"1062-Pl88DazTBuJo//SQVNUn6pZAllk"')
            .expect(201);

            headers.etag.should.equal('"1062-Pl88DazTBuJo//SQVNUn6pZAllk"');
        });

        test('304s on ETag match', async () => {
            await request
            .post('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/playbook_runs')
            .set(auth.fifi)
            .set('if-match', '"1062-Pl88DazTBuJo//SQVNUn6pZAllk"')
            .expect(201);
        });

        test('returns 412 if ETags not match', async () => {
            const {headers} = await request
            .post('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/playbook_runs')
            .set(auth.fifi)
            .set('if-match', '"1062-Pl88DazTBuJo//SQVNUn6pZAlmk"')
            .expect(412);

            headers.etag.should.equal('"1062-Pl88DazTBuJo//SQVNUn6pZAllk"');
        });

        test('if if-match is not present, proceed', async () => {
            await request
            .post('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/playbook_runs')
            .set(auth.fifi)
            .expect(201);
        });

        test('check object being send to receptor connector', async function () {
            mockDate();
            mockPlaybookRunId();

            const spy = base.getSandbox().spy(receptor, 'postInitialRequest');

            await request
            .post('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs')
            .set(auth.fifi)
            .expect(201);

            spy.callCount.should.equal(2);
            expect(spy.args[0]).toMatchSnapshot();
            expect(spy.args[1]).toMatchSnapshot();
        });

        test('if no executors are send to postInitialRequest', async function () {
            base.getSandbox().stub(fifi, 'sendInitialRequest').resolves(null);

            const {body} = await request
            .post('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs')
            .set(auth.fifi)
            .expect(400);

            body.errors[0].should.have.property('code', 'NO_EXECUTORS');
            body.errors[0].should.have.property('title',
                'No executors available for Playbook "FiFI playbook 3" (249f142c-2ae3-4c3f-b2ec-c8c5881f8561)');
        });

        test('if 1st executor result from receptor connector is request error', async function () {
            base.getSandbox().stub(receptor, 'postInitialRequest')
            .rejects(errors.internal.dependencyError(new Error('receptor down'), receptor));

            const {body} = await request
            .post('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs')
            .set(auth.fifi)
            .expect(503);

            body.errors[0].should.have.property('code', 'DEPENDENCY_UNAVAILABLE');
            body.errors[0].details.should.have.property('name', 'receptor');
            body.errors[0].details.should.have.property('impl', 'mock');
        });

        test('if 2nd executor result from receptor is request error', async function () {
            base.getSandbox().stub(receptor, 'postInitialRequest')
            .onCall(2)
            .rejects(errors.internal.dependencyError(new Error('receptor down'), receptor));

            const {body} =  await request
            .post('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs')
            .set(auth.fifi)
            .expect(201);

            body.should.have.property('id');
        });
    });
});

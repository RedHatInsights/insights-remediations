'use strict';

const _ = require('lodash');
const { request, auth, reqId } = require('../test');
const utils = require('../middleware/identity/utils');

function test400 (name, url, code, title) {
    test(name, async () => {
        const {id, header} = reqId();
        const { body } = await request
        .get(url)
        .set(header)
        .expect(400);

        body.errors.should.eql([{
            id,
            status: 400,
            code,
            title
        }]);
    });
}

describe('remediations', function () {
    describe('list', function () {

        const [r178, re80, rcbc, r66e, r256] = [
            '178cf0c8-35dd-42a3-96d5-7b50f9d211f6',
            'e809526c-56f5-4cd8-a809-93328436ea23',
            'cbc782e4-e8ae-4807-82ab-505387981d2e',
            '66eec356-dd06-4c72-a3b6-ef27d1508a02',
            '256ab1d3-58cf-1292-35e6-1a49c8b122d3'
        ];

        async function testList (desc, url, ...ids) {
            test(desc, async () => {
                const {body, text} = await request
                .get(url)
                .expect(200);

                body.should.have.property('data');
                _.map(body.data, 'id').should.eql(ids);
                expect(text).toMatchSnapshot();
            });
        }

        test('list remediations', async () => {
            const {body, text} = await request
            .get('/v1/remediations?pretty')
            .expect(200);

            body.should.have.property('data');
            body.data.should.not.be.empty();
            _.map(body.data, 'id').should.eql([
                '256ab1d3-58cf-1292-35e6-1a49c8b122d3',
                '178cf0c8-35dd-42a3-96d5-7b50f9d211f6',
                'e809526c-56f5-4cd8-a809-93328436ea23',
                'cbc782e4-e8ae-4807-82ab-505387981d2e',
                '66eec356-dd06-4c72-a3b6-ef27d1508a02'
            ]);

            expect(text).toMatchSnapshot();
        });

        test('does not leak data outside of the account', async () => {
            const {body} = await request
            .get('/v1/remediations?username=99999')
            .expect(200);

            body.should.have.property('data');
            body.data.should.be.empty();
        });

        test('does not leak data outside of the account (2)', async () => {
            const {body} = await request
            .get('/v1/remediations?user_id=99999')
            .set(auth.emptyInternal)
            .expect(200);

            body.should.have.property('data');
            body.data.should.be.empty();
        });

        describe('sorting', function () {
            testList('default', '/v1/remediations?pretty', r256, r178, re80, rcbc, r66e);

            function testSorting (column, asc, ...expected) {
                test(`${column} ${asc ? 'ASC' : 'DESC'}`, async () => {
                    const {body} = await request
                    .get(`/v1/remediations?pretty&sort=${asc ? '' : '-'}${column}`)
                    .expect(200);
                    _.map(body.data, 'id').should.eql(expected);
                });
            }

            testSorting('updated_at', true, r66e, rcbc, re80, r178, r256);
            testSorting('updated_at', false, r256, r178, re80, rcbc, r66e);
            testSorting('name', true, r66e, rcbc, r178, r256, re80);
            testSorting('name', false, re80, r256, r178, rcbc, r66e);
            testSorting('issue_count', true, r256, r178, re80, rcbc, r66e);
            testSorting('issue_count', false, r66e, rcbc, r178, re80, r256);
            testSorting('system_count', true, r256, r178, rcbc, r66e, re80);
            testSorting('system_count', false, r66e, re80, r178, rcbc, r256);

            test400(
                'invalid column',
                '/v1/remediations?pretty&sort=foo',
                'enum.openapi.validation',
                'should be equal to one of the allowed values (location: query, path: sort)'
            );
        });

        describe('system filter', function () {
            testList(
                'filters out remediations not featuring the given system',
                '/v1/remediations?system=1f12bdfc-8267-492d-a930-92f498fe65b9&pretty',
                re80, r66e
            );

            testList(
                'filters out remediations not featuring the given system (2)',
                '/v1/remediations?system=fc94beb8-21ee-403d-99b1-949ef7adb762&pretty',
                r178, re80, rcbc, r66e
            );

            test400(
                '400s on invalid format',
                '/v1/remediations?system=foo',
                'format.openapi.validation',
                'should match format "uuid" (location: query, path: system)'
            );
        });

        describe('filter', function () {
            testList('empty filter', '/v1/remediations?filter=&pretty', r256, r178, re80, rcbc, r66e);
            testList('basic filter', '/v1/remediations?filter=remediation&pretty', r256, r178, rcbc, r66e);
            testList('filter case does not matter', '/v1/remediations?filter=REBooT&pretty', r178);
            testList('filter matches on default name', '/v1/remediations?filter=unnamed&pretty', re80);
            testList('filter matches on number', '/v1/remediations?filter=2&pretty', rcbc);
        });

        describe('pagination', function () {
            testList('tiny page', '/v1/remediations?limit=2&pretty', r256, r178);
            testList('explicit offset', '/v1/remediations?limit=2&offset=0&pretty', r256, r178);
            testList('offset 1', '/v1/remediations?limit=2&offset=1&pretty', r178, re80);
            testList('offset 2', '/v1/remediations?limit=2&offset=2&pretty', re80, rcbc);
            testList('offset 3', '/v1/remediations?limit=2&offset=3&pretty', rcbc, r66e);

            test400(
                '400s on zero limit',
                '/v1/remediations?limit=0',
                'minimum.openapi.validation',
                'should be >= 1 (location: query, path: limit)'
            );

            test400(
                '400s on huge limit',
                '/v1/remediations?limit=24000000',
                'maximum.openapi.validation',
                'should be <= 200 (location: query, path: limit)'
            );

            test400(
                '400s on invalid offset type',
                '/v1/remediations?offset=false',
                'type.openapi.validation',
                'should be number (location: query, path: offset)'
            );

            test400(
                '400s on offset too large',
                '/v1/remediations?offset=123456',
                'INVALID_OFFSET',
                'Requested starting offset 123456 out of range: [0, 4]'
            );
        });
    });

    describe('get', function () {
        test('get remediation', async () => {
            const {text} = await request
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d1508a02?pretty')
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('get remediation (2)', async () => {
            const {body} = await request
            .get('/v1/remediations/e809526c-56f5-4cd8-a809-93328436ea23')
            .expect(200);

            body.should.eql({
                id: 'e809526c-56f5-4cd8-a809-93328436ea23',
                name: 'Unnamed Playbook',
                needs_reboot: false,
                auto_reboot: false,
                created_by: {
                    username: 'tuser@redhat.com',
                    first_name: 'test',
                    last_name: 'user'
                },
                created_at: '2018-12-04T08:19:36.641Z',
                updated_by: {
                    username: 'tuser@redhat.com',
                    first_name: 'test',
                    last_name: 'user'
                },
                updated_at: '2018-12-04T08:19:36.641Z',
                issues: [{
                    id: 'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE',
                    description: 'Bonding will not fail over to the backup link when bonding options are partially read',
                    resolution: {
                        id: 'fix',
                        description: 'Correct Bonding Config Items',
                        resolution_risk: 3,
                        needs_reboot: false
                    },
                    resolutions_available: 1,
                    systems: [{
                        id: '1f12bdfc-8267-492d-a930-92f498fe65b9',
                        hostname: '1f12bdfc-8267-492d-a930-92f498fe65b9.example.com',
                        display_name: null
                    }, {
                        id: 'fc94beb8-21ee-403d-99b1-949ef7adb762',
                        hostname: null,
                        display_name: null
                    }]
                }]
            });
        });

        test('get remediation with many systems', async () => {
            const {body, text} = await request
            .get('/v1/remediations/c3f9f751-4bcc-4222-9b83-77f5e6e603da?pretty')
            .set(auth.testReadSingle)
            .expect(200);

            body.issues[0].systems.should.have.length(250);
            expect(text).toMatchSnapshot();
        });

        // This test will be changed when content is added to this method
        test('get connection status (no content resp)', async () => {
            const {text} = await request
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d1508a02/connection_status')
            .expect(204);

            expect(text).toMatchSnapshot();
        });

        test('400 get connection status', async () => {
            await request
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d150000/connection_status')
            .expect(400);
        });

        test('get connection status with false smartManagement', async () => {
            await request
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d1508a02/connection_status')
            .set(utils.IDENTITY_HEADER, utils.createIdentityHeader(undefined, undefined, true, data => {
                data.entitlements.smart_management = false;
                return data;
            }))
            .expect(403);
        });
    });

    describe('missing', function () {
        test('get remediation with missing system', async () => {
            const {body} = await request
            .get('/v1/remediations/82aeb63f-fc25-4eef-9333-4fa7e10f7217?pretty')
            .set(auth.testReadSingle)
            .expect(200);

            body.issues[0].systems.should.have.length(1);
            body.issues[0].systems[0].should.have.property('id', '1040856f-b772-44c7-83a9-eea4813c4be8');
        });

        test('get remediation with missing system causing an issue to be empty', async () => {
            const {body} = await request
            .get('/v1/remediations/27e36e14-e1c2-4b5a-9382-ec80ca9a6c1a?pretty')
            .set(auth.testReadSingle)
            .expect(200);

            body.issues.should.have.length(1);
            body.issues[0].should.have.property('id', 'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074');
            body.issues[0].systems.should.have.length(1);
            body.issues[0].systems[0].should.have.property('id', '1040856f-b772-44c7-83a9-eea4813c4be8');
        });

        test('get remediation with unknown resolution', async () => {
            const {body} = await request
            .get('/v1/remediations/ea5b1507-4cd3-4c87-aa5a-6c755d32a7bd?pretty')
            .set(auth.testReadSingle)
            .expect(200);

            body.issues.should.have.length(1);
            body.issues[0].resolution.should.have.property('id', 'fix');
        });

        test('get remediation with unknown issues', async () => {
            const {body} = await request
            .get('/v1/remediations/62c95092-ac83-4025-a676-362a67e68579?pretty')
            .set(auth.testReadSingle)
            .expect(200);

            body.issues.should.have.length(0);
        });

        test('listing of remediations does not blow up', async () => {
            const {text} = await request
            .get('/v1/remediations?pretty')
            .set(auth.testReadSingle)
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('in the list remediation with 0 systems appears as having 0 issues also', async () => {
            const {body} = await request
            .get('/v1/remediations?pretty')
            .set(auth.testReadSingle)
            .expect(200);

            const remediation = _.find(body.data, {id: 'd1b070b5-1db8-4dac-8ecf-891dc1e9225f'});
            remediation.should.have.property('system_count', 0);
            remediation.should.have.property('issue_count', 0);
        });
    });
});

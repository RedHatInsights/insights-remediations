/* eslint-disable max-len */
'use strict';

const _ = require('lodash');
const { request, auth, reqId, buildRbacResponse, getSandbox, mockTime } = require('../test');
const rbac = require('../connectors/rbac');
const inventory = require('../connectors/inventory');
const JSZip = require('jszip');

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

function binaryParser (res, callback) {
    res.setEncoding('binary');
    res.data = '';
    res.on('data', function (chunk) {
        res.data += chunk;
    });
    res.on('end', function () {
        callback(null, new Buffer.from(res.data, 'binary'));
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

        test('list remediations with extra run data', async () => {
            const {body} = await request
            .get('/v1/remediations?fields[data]=playbook_runs&sort=name&limit=3')
            .set(auth.fifi)
            .expect(200);

            // can't check against a snapshot because the fifi tests are not
            // idempotent and test execution order is random
            for (const remediation of body.data) {
                expect(remediation).toHaveProperty('playbook_runs');
                expect(remediation.playbook_runs).toHaveProperty('meta');
                expect(remediation.playbook_runs).toHaveProperty('data');
            }
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

        describe('hide archived', function () {
            testList('no query', '/v1/remediations?pretty', r256, r178, re80, rcbc, r66e);
            testList('hide_archived', '/v1/remediations?hide_archived', r256, re80, rcbc);
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
                archived: false,
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
                resolved_count: 1,
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
                        display_name: null,
                        resolved: true
                    }, {
                        id: 'fc94beb8-21ee-403d-99b1-949ef7adb762',
                        hostname: null,
                        display_name: null,
                        resolved: true
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

        test('get remediation with test namespace resolutions', async () => {
            const {body, text} = await request
            .get('/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4?pretty')
            .set(auth.testReadSingle)
            .expect(200);

            body.issues.should.have.length(2);
            expect(text).toMatchSnapshot();
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

        test('get remediation with system-less issue', async () => {
            const {body} = await request
            .get('/v1/remediations/d1b070b5-1db8-4dac-8ecf-891dc1e9225f?pretty')
            .set(auth.testReadSingle)
            .expect(200);

            body.issues.should.have.length(0);
            body.resolved_count.should.equal(0);
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
            remediation.should.have.property('resolved_count', 0);
        });
    });

    describe('remediation issue systems', function () {
        test('gets list of hosts', async () => {
            const {text, body} = await request
            .get('/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/issues/test:ping/systems')
            .set(auth.testReadSingle)
            .expect(200);

            body.meta.count.should.eql(2);
            body.meta.total.should.eql(2);
            body.data[0].should.have.property('id', '9dae9304-86a8-4f66-baa3-a1b27dfdd479');
            body.data[0].should.have.property('hostname', '9dae9304-86a8-4f66-baa3-a1b27dfdd479');
            body.data[0].should.have.property('display_name', '9dae9304-86a8-4f66-baa3-a1b27dfdd479-system');

            body.data[1].should.have.property('id', '1040856f-b772-44c7-83a9-eea4813c4be8');
            body.data[1].should.have.property('hostname', '1040856f-b772-44c7-83a9-eea4813c4be8.example.com');
            body.data[1].should.have.property('display_name', null);

            expect(text).toMatchSnapshot();
        });

        test('gets list of hosts with same display name', async () => {
            getSandbox().stub(inventory, 'getSystemDetailsBatch').resolves({
                '1040856f-b772-44c7-83a9-eea4813c4be8': {
                    id: '1040856f-b772-44c7-83a9-eea4813c4be8',
                    hostname: '1040856f-b772-44c7-83a9-eea4813c4be8.example.com',
                    display_name: '9dae9304-86a8-4f66-baa3-a1b27dfdd479-system',
                    ansible_host: '1040856f-b772-44c7-83a9-eea4813c4be8.ansible.example.com',
                    facts: [
                        {
                            namespace: 'satellite',
                            facts: { satellite_instance_id: '72f44b25-64a7-4ee7-a94e-3beed9393972' }
                        }
                    ]
                },
                '9dae9304-86a8-4f66-baa3-a1b27dfdd479': {
                    id: '9dae9304-86a8-4f66-baa3-a1b27dfdd479',
                    hostname: '9dae9304-86a8-4f66-baa3-a1b27dfdd479',
                    display_name: '9dae9304-86a8-4f66-baa3-a1b27dfdd479-system',
                    ansible_host: '9dae9304-86a8-4f66-baa3-a1b27dfdd479.ansible.example.com',
                    facts: [
                        {
                            namespace: 'satellite',
                            facts: { satellite_instance_id: '01bf542e-6092-485c-ba04-c656d77f988a' }
                        }
                    ]
                }
            });

            const {text, body} = await request
            .get('/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/issues/test:ping/systems')
            .set(auth.testReadSingle)
            .expect(200);

            body.meta.count.should.eql(2);
            body.meta.total.should.eql(2);
            body.data[0].should.have.property('id', '1040856f-b772-44c7-83a9-eea4813c4be8');
            body.data[0].should.have.property('hostname', '1040856f-b772-44c7-83a9-eea4813c4be8.example.com');
            body.data[0].should.have.property('display_name', '9dae9304-86a8-4f66-baa3-a1b27dfdd479-system');

            body.data[1].should.have.property('id', '9dae9304-86a8-4f66-baa3-a1b27dfdd479');
            body.data[1].should.have.property('hostname', '9dae9304-86a8-4f66-baa3-a1b27dfdd479');
            body.data[1].should.have.property('display_name', '9dae9304-86a8-4f66-baa3-a1b27dfdd479-system');

            expect(text).toMatchSnapshot();
        });

        test('sort list ascending', async () => {
            const {text, body} = await request
            .get('/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/issues/test:ping/systems?sort=display_name')
            .set(auth.testReadSingle)
            .expect(200);

            body.meta.count.should.eql(2);
            body.meta.total.should.eql(2);
            body.data[0].should.have.property('id', '9dae9304-86a8-4f66-baa3-a1b27dfdd479');
            body.data[0].should.have.property('hostname', '9dae9304-86a8-4f66-baa3-a1b27dfdd479');
            body.data[0].should.have.property('display_name', '9dae9304-86a8-4f66-baa3-a1b27dfdd479-system');

            body.data[1].should.have.property('id', '1040856f-b772-44c7-83a9-eea4813c4be8');
            body.data[1].should.have.property('hostname', '1040856f-b772-44c7-83a9-eea4813c4be8.example.com');
            body.data[1].should.have.property('display_name', null);

            expect(text).toMatchSnapshot();
        });

        test('sort list descending', async () => {
            const {text, body} = await request
            .get('/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/issues/test:ping/systems?sort=-display_name')
            .set(auth.testReadSingle)
            .expect(200);

            body.meta.count.should.eql(2);
            body.meta.total.should.eql(2);

            body.data[0].should.have.property('id', '1040856f-b772-44c7-83a9-eea4813c4be8');
            body.data[0].should.have.property('hostname', '1040856f-b772-44c7-83a9-eea4813c4be8.example.com');
            body.data[0].should.have.property('display_name', null);

            body.data[1].should.have.property('id', '9dae9304-86a8-4f66-baa3-a1b27dfdd479');
            body.data[1].should.have.property('hostname', '9dae9304-86a8-4f66-baa3-a1b27dfdd479');
            body.data[1].should.have.property('display_name', '9dae9304-86a8-4f66-baa3-a1b27dfdd479-system');

            expect(text).toMatchSnapshot();
        });

        test('set limit = 1', async () => {
            const {text, body} = await request
            .get('/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/issues/test:ping/systems?limit=1')
            .set(auth.testReadSingle)
            .expect(200);

            body.meta.count.should.eql(1);
            body.meta.total.should.eql(2);

            body.data[0].should.have.property('id', '9dae9304-86a8-4f66-baa3-a1b27dfdd479');
            body.data[0].should.have.property('hostname', '9dae9304-86a8-4f66-baa3-a1b27dfdd479');
            body.data[0].should.have.property('display_name', '9dae9304-86a8-4f66-baa3-a1b27dfdd479-system');

            expect(text).toMatchSnapshot();
        });

        test('set offset = 1', async () => {
            const {text, body} = await request
            .get('/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/issues/test:ping/systems?offset=1')
            .set(auth.testReadSingle)
            .expect(200);

            body.meta.count.should.eql(1);
            body.meta.total.should.eql(2);

            body.data[0].should.have.property('id', '1040856f-b772-44c7-83a9-eea4813c4be8');
            body.data[0].should.have.property('hostname', '1040856f-b772-44c7-83a9-eea4813c4be8.example.com');
            body.data[0].should.have.property('display_name', null);

            expect(text).toMatchSnapshot();
        });

        test('404 on unknown remediation_id', async () => {
            await request
            .get('/v1/remediations/f7ee704e-4d66-49c8-849a-d236e9d554e2/issues/test:ping/systems')
            .set(auth.testReadSingle)
            .expect(404);
        });

        test('404 on unknown issue_id', async () => {
            await request
            .get('/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/issues/advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074/systems')
            .set(auth.testReadSingle)
            .expect(404);
        });

        test('404 on issue with no systems', async () => {
            await request
            .get('/v1/remediations/d1b070b5-1db8-4dac-8ecf-891dc1e9225f/issues/vulnerabilities:CVE-2019-6133/systems')
            .set(auth.testReadSingle)
            .expect(404);
        });

        test('400 on giant offset', async () => {
            const {body} = await request
            .get('/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/issues/test:ping/systems?offset=1000000000')
            .set(auth.testReadSingle)
            .expect(400);

            body.errors[0].code.should.eql('INVALID_OFFSET');
            body.errors[0].title.should.eql('Requested starting offset 1000000000 out of range: [0, 2]');
        });

        test400(
            '400 on giant limit',
            '/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/issues/test:ping/systems?limit=2000000000000000',
            'maximum.openapi.validation',
            'should be <= 200 (location: query, path: limit)'
        );

        test400(
            '400 on bad remediation_id',
            '/v1/remediations/f7ee704e-4d66-49c8-849a-d2/issues/test:ping/systems',
            'format.openapi.validation',
            'should match format "uuid" (location: path, path: id)'
        );

        test400(
            '400 on bad issue_id',
            '/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/issues/test:/systems',
            'pattern.openapi.validation',
            'should match pattern "^(advisor|vulnerabilities|ssg|test|patch-advisory|patch-package):[\\w\\d_|:\\.+-]+$" (location: path, path: issue)'
        );

        test400(
            '400 when limit=0',
            '/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/issues/test:ping/systems?limit=0',
            'minimum.openapi.validation',
            'should be >= 1 (location: query, path: limit)'
        );

        test400(
            '400 on bad limit',
            '/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/issues/test:ping/systems?limit=egg',
            'type.openapi.validation',
            'should be number (location: query, path: limit)'
        );

        test400(
            '400 on bad offset',
            '/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/issues/test:ping/systems?offset=salad',
            'type.openapi.validation',
            'should be number (location: query, path: offset)'
        );
    });

    describe('remediations read RBAC', function () {
        test('permission = remediations:*:write does not allow GET /v1/remediations to be read', async () => {
            getSandbox().stub(rbac, 'getRemediationsAccess').resolves(buildRbacResponse('remediations:*:write'));

            const {body} = await request
            .get('/v1/remediations?pretty')
            .expect(403);

            body.errors[0].details.message.should.equal(
                'Permission remediations:remediation:read is required for this operation'
            );
        });

        test('permission = remediations:resolution:* does not allow GET /v1/remediations to be read', async () => {
            getSandbox().stub(rbac, 'getRemediationsAccess').resolves(buildRbacResponse('remediations:resolution:*'));

            const {body} = await request
            .get('/v1/remediations?pretty')
            .expect(403);

            body.errors[0].details.message.should.equal(
                'Permission remediations:remediation:read is required for this operation'
            );
        });

        test('permission = [] does not allow GET /v1/remediations to be read', async () => {
            getSandbox().stub(rbac, 'getRemediationsAccess').resolves([]);

            const {body} = await request
            .get('/v1/remediations?pretty')
            .expect(403);

            body.errors[0].details.message.should.equal(
                'Permission remediations:remediation:read is required for this operation'
            );
        });
    });

    describe('download remediations', function () {
        /* eslint-disable jest/valid-expect-in-promise */
        test('download zip and verify remediation content', async () => {
            mockTime();
            const result = await request
            .get('/v1/remediations/download?selected_remediations=c3f9f751-4bcc-4222-9b83-77f5e6e603da')
            .set('Accept', 'application/zip')
            .set(auth.testReadSingle)
            .expect('Content-Type', 'application/zip')
            .expect(200)
            .buffer()
            .parse(binaryParser)
            .then(function (res) {
                const zip = new JSZip();
                return zip.loadAsync(res.body).then(function (z) {
                    expect(Object.keys(z.files).length).toBe(1);
                    return z.file('many-systems-1546071635.yml').async('string');
                }).then(function (text) {
                    return text.replace(/# Generated.+/, '');
                });
            });

            expect(result).toMatchSnapshot();
        });

        test('download zip with multiple remediations and verify number of files', async () => {
            mockTime();
            const result = await request
            .get('/v1/remediations/download?selected_remediations=c3f9f751-4bcc-4222-9b83-77f5e6e603da,82aeb63f-fc25-4eef-9333-4fa7e10f7217')
            .set('Accept', 'application/zip')
            .set(auth.testReadSingle)
            .expect('Content-Type', 'application/zip')
            .expect(200)
            .buffer()
            .parse(binaryParser)
            .then(function (res) {
                const zip = new JSZip();
                return zip.loadAsync(res.body).then(function (z) {
                    expect(Object.keys(z.files).length).toBe(2);
                    return z.file('missing-system-1-1546071635.yml').async('string');
                }).then(function (text) {
                    return text.replace(/# Generated.+/, '');
                });
            });

            expect(result).toMatchSnapshot();
        });

        test('with empty selected_remediations', async () => {
            const {body} = await request
            .get('/v1/remediations/download?selected_remediations=')
            .expect(400);

            body.errors[0].title.should.equal(
                'should match format "uuid" (location: query, path: selected_remediations[0])'
            );
        });

        test('with valid, but non existent remediationId', async () => {
            await request
            .get('/v1/remediations/download?selected_remediations=77eec356-dd06-4c72-a3b6-ef27d1508a02')
            .expect(404);
        });
    });
});

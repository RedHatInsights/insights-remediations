/* eslint-disable max-len */
'use strict';

const _ = require('lodash');
const { request, auth, reqId, buildRbacResponse, getSandbox, mockTime } = require('../test');
const rbac = require('../connectors/rbac');
const inventory = require('../connectors/inventory');
const JSZip = require('jszip');
const base = require('../test');
const impl = require('../connectors/dispatcher/impl');
const dispatcher = require('../connectors/dispatcher');
const fifi2 = require('./fifi_2');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

function test400 (name, url, code, title) {
    test(name, async () => {
        const {id, header} = reqId();
        const { body } = await request
        .get(url)
        .set(header)
        .expect(400);

        body.errors.should.containEql({
            id,
            status: 400,
            code,
            title
        });
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

let originalRem1;
let originalRem2;
describe('remediations', function () {
    describe('SSG issue id (v1 vs v2) on read', function () {
        let createdIds = [];

        afterEach(async () => {
            // cleanup created records
            for (const remId of createdIds) {
                await db.issue.destroy({ where: { remediation_id: remId }, force: true });
                await db.remediation.destroy({ where: { id: remId }, force: true });
            }
            createdIds = [];
        });

        test('v1 SSG issue id fails with INVALID_ISSUE_IDENTIFIER', async () => {
            const remId = uuidv4();
            createdIds.push(remId);

            await db.remediation.create({
                id: remId,
                name: 'v1-ssg-remediation',
                needs_reboot: false,
                tenant_org_id: '0000000',
                account_number: '0000000',
                created_by: 'tuser@redhat.com',
                updated_by: 'tuser@redhat.com'
            });

            await db.issue.create({
                remediation_id: remId,
                issue_id: 'ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_disable_prelink',
                resolution: 'fix'
            });

            await db.issue_system.bulkCreate([{
                remediation_issue_id: (await db.issue.findOne({ where: { remediation_id: remId } })).id,
                system_id: '1f12bdfc-8267-492d-a930-92f498fe65b9'
            }]);

            const { id, header } = reqId();
            const { body } = await request
                .get(`/v1/remediations/${remId}`)
                .set(header)
                .expect(400);

            body.errors.should.be.Array();
            body.errors[0].code.should.equal('INVALID_ISSUE_IDENTIFIER');
            body.errors[0].id.should.equal(id);
        });

        test('v2 SSG issue id succeeds', async () => {
            const remId = uuidv4();
            createdIds.push(remId);

            await db.remediation.create({
                id: remId,
                name: 'v2-ssg-remediation',
                needs_reboot: false,
                tenant_org_id: '0000000',
                account_number: '0000000',
                created_by: 'tuser@redhat.com',
                updated_by: 'tuser@redhat.com'
            });

            await db.issue.create({
                remediation_id: remId,
                issue_id: 'ssg:xccdf_org.ssgproject.content_benchmark_RHEL-7|1.0.0|standard|xccdf_org.ssgproject.content_rule_disable_prelink',
                resolution: 'fix'
            });

            await db.issue_system.bulkCreate([{
                remediation_issue_id: (await db.issue.findOne({ where: { remediation_id: remId } })).id,
                system_id: '1f12bdfc-8267-492d-a930-92f498fe65b9'
            }]);

            const { body } = await request
                .get(`/v1/remediations/${remId}`)
                .expect(200);

            body.should.have.property('issues');
            body.issues.should.have.length(1);
            body.issues[0].should.have.property('resolution');
            body.issues[0].resolution.should.have.property('id', 'fix');
        });
    });
    describe('list', function () {
        beforeAll(async () => {
            originalRem1 = await db.remediation.findByPk('249f142c-2ae3-4c3f-b2ec-c8c5881f8561');
            originalRem2 = await db.remediation.findByPk('efe9fd2b-fdbd-4c74-93e7-8c69f1b668f3');
            await db.remediation.update(
                { tenant_org_id: '0000000', created_by: 'tuser@redhat.com', updated_at: new Date('2021-01-01T00:00:00Z') },
                { where: { id: originalRem1.id }, silent: true }
            );
            await db.remediation.update(
                { tenant_org_id: '0000000', created_by: 'tuser@redhat.com', updated_at: new Date('2021-01-01T00:00:00Z') },
                { where: {  id: originalRem2.id }, silent: true }
            );

            await db.playbook_runs.update(
                { created_at: new Date('2024-09-11T12:00:00Z') },
                { where: { id: '88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc' }, silent: true }
            );
        });

        afterAll(async () => {
            await db.remediation.update(
                { tenant_org_id: originalRem1.tenant_org_id, created_by: originalRem1.created_by, updated_at: originalRem1.updated_at },
                { where: { id: originalRem1.id}, silent: true }
            );
            await db.remediation.update(
                { tenant_org_id: originalRem2.tenant_org_id, created_by: originalRem2.created_by, updated_at: originalRem2.updated_at },
                { where: { id: originalRem2.id}, silent: true }
            );
            await db.playbook_runs.update(
                { created_at: new Date('2019-12-23T08:19:36.641Z') },
                { where: { id: '88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc' }, silent: true }
            );
        });

        const [r178, re80, rcbc, r66e, r256, refe, r249] = [
            '178cf0c8-35dd-42a3-96d5-7b50f9d211f6',
            'e809526c-56f5-4cd8-a809-93328436ea23',
            'cbc782e4-e8ae-4807-82ab-505387981d2e',
            '66eec356-dd06-4c72-a3b6-ef27d1508a02',
            '256ab1d3-58cf-1292-35e6-1a49c8b122d3',
            'efe9fd2b-fdbd-4c74-93e7-8c69f1b668f3',
            '249f142c-2ae3-4c3f-b2ec-c8c5881f8561'
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
                'efe9fd2b-fdbd-4c74-93e7-8c69f1b668f3',
                '249f142c-2ae3-4c3f-b2ec-c8c5881f8561',
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
            }
        });

        test('list remediations with fields[data]=playbook_runs includes remediations with no playbook runs', async () => {
            await db.playbook_runs.destroy({ where: { remediation_id: '0ecb5db7-2f1a-441b-8220-e5ce45066f50' }, force: true });
            
            const {body} = await request
            .get('/v1/remediations?fields[data]=playbook_runs&sort=name&limit=3')
            .set(auth.fifi)
            .expect(200);

            const remWithNoPlaybookRuns = body.data.find(r => r.id === '0ecb5db7-2f1a-441b-8220-e5ce45066f50');
            expect(remWithNoPlaybookRuns).toBeTruthy();
            expect((remWithNoPlaybookRuns.playbook_runs || []).length).toBe(0);
        });

        test('list remediation plan names for org', async () => {
            const {body} = await request
            .get('/v1/remediations?fields[data]=name')
            .set(auth.fifi)
            .expect(200);

            // items in list should only have 'name' field
            for (const item of body.data) {
                expect(Object.keys(item)).toHaveLength(1);
                expect(item).toHaveProperty('name');
            }
        });

        test('fields[data]=names cannot be combined', async () => {
            const {body} = await request
            .get('/v1/remediations?fields[data]=playbook_runs&fields[data]=name')
            .set(auth.fifi)
            .expect(400);
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
            testList('default', '/v1/remediations?pretty', refe, r249, r256, r178, re80, rcbc, r66e);

            function testSorting (column, asc, ...expected) {
                test(`${column} ${asc ? 'ASC' : 'DESC'}`, async () => {
                    const {body} = await request
                    .get(`/v1/remediations?pretty&sort=${asc ? '' : '-'}${column}`)
                    .expect(200);
                    _.map(body.data, 'id').should.eql(expected);
                });
            }

            testSorting('updated_at', true, r66e, rcbc, re80, r178, r256, r249, refe);
            testSorting('updated_at', false, refe, r249, r256, r178, re80, rcbc, r66e);
            testSorting('name', true, r249, r178, r256, refe, r66e, rcbc, re80);
            testSorting('name', false, re80, rcbc, r66e, refe, r256, r178, r249);
            testSorting('issue_count', true, r256, r178, r249, re80, refe, rcbc, r66e);
            testSorting('issue_count', false, r66e, rcbc, r178, r249, re80, refe, r256);
            testSorting('system_count', true, r256, r178, rcbc, r66e, re80, refe, r249);
            testSorting('system_count', false, r249, refe, r66e, re80, r178, rcbc, r256);
            testSorting('last_run_at', true, refe, r249, r178, r256, r66e, rcbc, re80);
            testSorting('last_run_at', false, r178, r256, r66e, rcbc, re80, r249, refe);

            // Status tests with isolated data setup
            describe('status tests', function () {
                // Use existing test remediations but create isolated dispatcher_runs 
                let isolatedDispatcherRunIds = [];

                beforeEach(async () => {
                    const { v4: uuidv4 } = require('uuid');
                    const now = new Date();
                    const { username: created_by } = require('../connectors/users/mock').MOCK_USERS.fifi;
                    
                    // Use transaction for atomic setup
                    await db.s.transaction(async (transaction) => {
                        // Clean up any existing dispatcher runs and playbook_runs for our test
                        await db.dispatcher_runs.destroy({
                            where: { 
                                remediations_run_id: '8ff5717a-cce8-4738-907b-a89eaa559275'  // Only playbook_run for refe
                            },
                            force: true,
                            transaction
                        });
                        
                        // Clean up any existing playbook_runs for r178 (should be none, but just in case)
                        await db.playbook_runs.destroy({
                            where: {
                                remediation_id: '178cf0c8-35dd-42a3-96d5-7b50f9d211f6' // r178
                            },
                            force: true,
                            transaction
                        });

                        // Create a fresh playbook_run for r178 to use for running status
                        const r178PlaybookRunId = uuidv4();
                        await db.playbook_runs.create({
                            id: r178PlaybookRunId,
                            status: 'running',
                            remediation_id: '178cf0c8-35dd-42a3-96d5-7b50f9d211f6', // r178
                            created_by,
                            created_at: now,
                            updated_at: now
                        }, { transaction });

                        // Create isolated dispatcher_runs with unique IDs we can track
                        const runningDispatcherRun1 = uuidv4();
                        const runningDispatcherRun2 = uuidv4();
                        const failureDispatcherRun = uuidv4();
                        
                        isolatedDispatcherRunIds = [runningDispatcherRun1, runningDispatcherRun2, failureDispatcherRun, r178PlaybookRunId];

                        // r178 should have 'running' status
                        await db.dispatcher_runs.bulkCreate([
                            {
                                dispatcher_run_id: runningDispatcherRun1,
                                remediations_run_id: r178PlaybookRunId,
                                status: 'running',
                                pd_response_code: null,
                                created_at: now,
                                updated_at: now
                            },
                            {
                                dispatcher_run_id: runningDispatcherRun2,
                                remediations_run_id: r178PlaybookRunId,
                                status: 'running',
                                pd_response_code: null,
                                created_at: now,
                                updated_at: now
                            }
                        ], { transaction });

                        // refe should have 'failure' status  
                        await db.dispatcher_runs.bulkCreate([
                            {
                                dispatcher_run_id: failureDispatcherRun,
                                remediations_run_id: '8ff5717a-cce8-4738-907b-a89eaa559275',
                                status: 'failure',
                                pd_response_code: null,
                                created_at: now,
                                updated_at: now
                            }
                        ], { transaction });
                    });

                    // Stub sync function to prevent it from interfering with our isolated data
                    base.getSandbox().stub(fifi2, 'syncDispatcherRunsForPlaybookRuns').resolves();
                    
                    // Verify data was created correctly
                    const createdRuns = await db.dispatcher_runs.findAll({
                        where: { 
                            dispatcher_run_id: isolatedDispatcherRunIds 
                        },
                        attributes: ['dispatcher_run_id', 'remediations_run_id', 'status']
                    });
                    
                    if (createdRuns.length !== 3) {
                        throw new Error(`Expected 3 dispatcher_runs, got ${createdRuns.length}`);
                    }
                    
                    const runningCount = createdRuns.filter(r => r.status === 'running').length;
                    if (runningCount !== 2) {
                        throw new Error(`Expected 2 'running' dispatcher_runs, got ${runningCount}`);
                    }
                });

                afterEach(async () => {
                    // Clean up by dispatcher_run_id to ensure we only remove our test data
                    await db.dispatcher_runs.destroy({
                        where: { 
                            dispatcher_run_id: isolatedDispatcherRunIds.filter(id => id.length < 36) // Only dispatcher_run_ids
                        },
                        force: true
                    });
                    
                    // Clean up any playbook_runs we created
                    await db.playbook_runs.destroy({
                        where: {
                            id: isolatedDispatcherRunIds.filter(id => id.length === 36) // Only playbook_run_ids (UUIDs)
                        },
                        force: true
                    });
                    
                    isolatedDispatcherRunIds = [];
                });

                // Status sorting tests
                testSorting('status', true, refe, r249, r256, r66e, rcbc, re80, r178);
                testSorting('status', false, r178, r249, r256, r66e, rcbc, re80, refe);

                // Status filtering tests  
                testList('status query running', '/v1/remediations?filter[status]=running', r178);
                testList('status query failure', '/v1/remediations?filter[status]=failure', refe);
                testList('status and name query', '/v1/remediations?filter[status]=running&filter[name]=Remediation with suppressed reboot', r178);
                testList('status and last_run_after query', '/v1/remediations?filter[status]=running&filter[last_run_after]=2018-09-04T08:19:36.641Z', r178);
            });

            test400(
                'invalid column',
                '/v1/remediations?pretty&sort=foo',
                'enum.openapi.requestValidation',
                'must be equal to one of the allowed values (location: query, path: sort)'
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
                'format.openapi.requestValidation',
                'must match format "uuid" (location: query, path: system)'
            );
        });

        describe('filter', function () {
            testList('empty filter', '/v1/remediations?filter=&pretty', refe, r249, r256, r178, re80, rcbc, r66e);
            testList('basic filter', '/v1/remediations?filter=remediation&pretty', r256, r178);
            testList('filter case does not matter', '/v1/remediations?filter=REBooT&pretty', r178);
            testList('filter matches on name', '/v1/remediations?filter=Test&pretty', refe, re80, rcbc, r66e);
            testList('filter matches on number', '/v1/remediations?filter=2&pretty', rcbc);

            describe('test new style filters', () => {
                describe('supported options', function () {
                    testList('name query with match', '/v1/remediations?filter[name]=REBoot', r178);
                    testList('name query no match', '/v1/remediations?filter[name]=REBootNoMatch');
                    testList("created_after=date/time query with match", '/v1/remediations?filter[created_after]=2018-12-04T08:19:36.641Z', refe, r249, r256, r178);
                    testList("created_after=date/time query no match", '/v1/remediations?filter[created_after]=2025-03-31T08:19:36.641Z');
                    testList("updated_after=date/time query with match", '/v1/remediations?filter[updated_after]=2018-12-04T08:19:36.641Z', refe, r249, r256, r178);
                    testList("updated_after=date/time query no match", '/v1/remediations?filter[updated_after]=2025-03-31T08:19:36.641Z');
                    testList('name and created_after query with match', '/v1/remediations?filter[name]=REBoot&filter[created_after]=2018-12-04T08:19:36.641Z', r178);
                    testList('name and created_after query no match', '/v1/remediations?filter[name]=REBootNoMatch&filter[created_after]=2018-12-04T08:19:36.641Z');
                    testList('last_run_after=date/time query no match', '/v1/remediations?filter[last_run_after]=2025-12-04T08:19:36.641Z');
                    testList('last_run_after=date/time query with match', '/v1/remediations?filter[last_run_after]=2016-12-04T08:19:36.641Z', refe, r249);
                    testList('last_run_after=never query with match', '/v1/remediations?filter[last_run_after]=never', r256, r178, re80, rcbc, r66e);
                    testList('name and last_run_after query no match', '/v1/remediations?filter[last_run_after]=2018-12-04T08:19:36.641Z&filter[name]=REBootNoMatch');
                });

                describe('invalid options', function () {
                    test400(
                        'unknown filter field',
                        '/v1/remediations?filter[bob]=uncle',
                        'type.openapi.requestValidation',
                        'must be string (location: query, path: filter)'
                    );
                    test400(
                        'bad date query',
                        '/v1/remediations?filter[created_after]=123',
                        'type.openapi.requestValidation',
                        'must be string (location: query, path: filter)'
                    );
                    test400(
                        'bad status query',
                        '/v1/remediations?filter[status]=invalid_status',
                        'enum.openapi.requestValidation',
                        'must be equal to one of the allowed values (location: query, path: filter.status)'
                    );
                    test400(
                        'timeout status query not allowed',
                        '/v1/remediations?filter[status]=timeout',
                        'enum.openapi.requestValidation',
                        'must be equal to one of the allowed values (location: query, path: filter.status)'
                    );
                });
            });
        });

        describe('pagination', function () {
            testList('tiny page', '/v1/remediations?limit=2&pretty', refe, r249);
            testList('explicit offset', '/v1/remediations?limit=2&offset=0&pretty', refe, r249);
            testList('offset 1', '/v1/remediations?limit=2&offset=1&pretty', r249, r256);
            testList('offset 2', '/v1/remediations?limit=2&offset=2&pretty', r256, r178);
            testList('offset 3', '/v1/remediations?limit=2&offset=3&pretty', r178, re80);

            test400(
                '400s on zero limit',
                '/v1/remediations?limit=0',
                'minimum.openapi.requestValidation',
                'must be >= 1 (location: query, path: limit)'
            );

            test400(
                '400s on huge limit',
                '/v1/remediations?limit=24000000',
                'maximum.openapi.requestValidation',
                'must be <= 200 (location: query, path: limit)'
            );

            test400(
                '400s on invalid offset type',
                '/v1/remediations?offset=false',
                'type.openapi.requestValidation',
                'must be number (location: query, path: offset)'
            );

            test400(
                '400s on offset too large',
                '/v1/remediations?offset=123456',
                'INVALID_OFFSET',
                'Requested starting offset 123456 out of range: [0, 6]'
            );
        });

        describe('hide archived', function () {
            testList('no query', '/v1/remediations?pretty', refe, r249, r256, r178, re80, rcbc, r66e);
            testList('hide_archived', '/v1/remediations?hide_archived', refe, r249, r256, re80, rcbc);
        });
    });

    describe('get', function () {
        test('get remediation', async () => {
            const {text} = await request
            .get('/v1/remediations/e809526c-56f5-4cd8-a809-93328436ea23?pretty')
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('get remediation (2)', async () => {
            const {body} = await request
            .get('/v1/remediations/e809526c-56f5-4cd8-a809-93328436ea23')
            .expect(200);

            body.should.eql({
                id: 'e809526c-56f5-4cd8-a809-93328436ea23',
                name: 'Test3',
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

        test('summary format', async () => {
            const {body} = await request
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d1508a02?format=summary')
            .expect(200);

            expect(body).not.toHaveProperty('needs_reboot');
            expect(body).not.toHaveProperty('issues');
            expect(body).not.toHaveProperty('resolved_count');
            expect(body).toHaveProperty('issue_count');
            expect(body).toHaveProperty('system_count');

            expect(body).toMatchSnapshot();
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

        // Build a temporary plan with unknown non-SSG issues so the endpoint returns 200 and filters them out.
        // The seeded 'unknown issues' plan includes a v1 SSG id that now returns 400 (invalid identifier), so we can't use it here.
        test('get remediation with unknown issues', async () => {
            const { account_number, tenant_org_id, username: created_by } = require('../connectors/users/mock').MOCK_USERS.testReadSingleUser;
            const remId = uuidv4();

            try {
                await db.remediation.create({
                    id: remId,
                    name: 'unknown issues (non-ssg)',
                    auto_reboot: true,
                    account_number,
                    tenant_org_id,
                    created_by,
                    updated_by: created_by
                });

                const createdIssues = await db.issue.bulkCreate([
                    { remediation_id: remId, issue_id: 'advisor:non-existent-issue-a' },
                    { remediation_id: remId, issue_id: 'advisor:non-existent-issue-b' }
                ], { returning: true });

                // attach systems so controller considers them, but issues will still be filtered out as unknown
                await db.issue_system.bulkCreate(createdIssues.map(i => ({
                    remediation_issue_id: i.id,
                    system_id: '1040856f-b772-44c7-83a9-eea4813c4be8',
                    resolved: false
                })));

                const {body} = await request
                .get(`/v1/remediations/${remId}?pretty`)
                .set(auth.testReadSingle)
                .expect(200);

                body.issues.should.have.length(0);
            } finally {
                await db.issue.destroy({ where: { remediation_id: remId }, force: true });
                await db.remediation.destroy({ where: { id: remId }, force: true });
            }
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

    describe('issues', function () {
        test('get remediation plan issues', async () => {
            const {body} = await request
            .get('/v1/remediations/e809526c-56f5-4cd8-a809-93328436ea23/issues?limit=4')
            .expect(200);

            expect(body).toMatchSnapshot();
        });

        test('get sorted plan issues', async () => {
            const {body} = await request
            .get('/v1/remediations/e809526c-56f5-4cd8-a809-93328436ea23/issues?sort=-id')
            .expect(200);

            expect(body).toMatchSnapshot();
        });

        test('get plan issues with unsupported sort', async () => {
            await request
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d1508a02/issues?sort=bob')
            .expect(400);
        });

        test('get filtered plan issues', async () => {
            const {body} = await request
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d1508a02/issues?filter[id]=cVe')
            .expect(200);

            expect(body).toMatchSnapshot();
        });

        test('not plan owner', async () => {
            const {body} = await request
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d1508a02/issues?limit=4')
            .set(auth.fifi)
            .expect(404);
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
            'maximum.openapi.requestValidation',
            'must be <= 200 (location: query, path: limit)'
        );

        test400(
            '400 on bad remediation_id',
            '/v1/remediations/f7ee704e-4d66-49c8-849a-d2/issues/test:ping/systems',
            'format.openapi.requestValidation',
            'must match format "uuid" (location: path, path: id)'
        );

        test400(
            '400 on bad issue_id',
            '/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/issues/test:/systems',
            'pattern.openapi.requestValidation',
            'must match pattern "^(advisor|vulnerabilities|ssg|test|patch-advisory|patch-package):[\\w\\d_|:\\.+-]+$" (location: path, path: issue)'
        );

        test400(
            '400 when limit=0',
            '/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/issues/test:ping/systems?limit=0',
            'minimum.openapi.requestValidation',
            'must be >= 1 (location: query, path: limit)'
        );

        test400(
            '400 on bad limit',
            '/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/issues/test:ping/systems?limit=egg',
            'type.openapi.requestValidation',
            'must be number (location: query, path: limit)'
        );

        test400(
            '400 on bad offset',
            '/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/issues/test:ping/systems?offset=salad',
            'type.openapi.requestValidation',
            'must be number (location: query, path: offset)'
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
                'must match format "uuid" (location: query, path: selected_remediations.0)'
            );
        });

        test('with valid, but non existent remediationId', async () => {
            await request
            .get('/v1/remediations/download?selected_remediations=77eec356-dd06-4c72-a3b6-ef27d1508a02')
            .expect(404);
        });
    });
});
